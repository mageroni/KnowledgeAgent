import { z } from "zod";
import crypto from "crypto";
import StorageAccount from './services/StorageAccount';
import AzureSearchService from "./services/AzureSearch";
import { getConfluenceContent } from './services/Confluence';

/*
import { OpenAI } from "openai";
import type { ChatCompletionStreamParams } from "openai/lib/ChatCompletionStream.mjs";
*/

const Message = z.object({
  role: z.string(),
  name: z.string().optional(),
  content: z.string(),
});

const Input = z.object({
  messages: z.array(Message),
});

type RequestMessage = {
  copilot_thread_id: string;
  agent: string;
  completion: Completion;
}

type Completion = {
	choices: Array<CompletionChoice>;
}

type CompletionChoice = {
	delta: Message;
}

type Message = {
	role: string;                  
	content: string;
}

let isIndexing = false;

interface CapiJson {
  choices: Array<{
    content_filter_results: Record<string, unknown>;
    finish_reason: string;
    index: number;
    message: {
      function_call: {
        arguments: string;
        name: string;
      };
      role: string;
    };
  }>;
}

interface Messages {
  messages:[
    {
      role: string;
      content: string;
      name?: string | undefined;
    }
  ]
};

//const openai = new OpenAI({ apiKey: Bun.env.OPENAI_API_KEY });

Bun.serve({
  port: Bun.env.PORT ?? "3000",

  async fetch(request) {
    console.debug("received request", request.url);

    // Do nothing with the OAuth callback, for now. Just return a 200.
    if (new URL(request.url).pathname === "/oauth/callback") {
      console.debug("received oauth callback");
      return Response.json({ ok: "Authentication successful! To get started, please ask the chat to begin indexing." }, { status: 200 });
    }

    const signature = request.headers.get("Github-Public-Key-Signature")!;
    const keyID = request.headers.get("Github-Public-Key-Identifier")!;
    const tokenForUser = request.headers.get("X-GitHub-Token")!;
    const payload = await request.text();
    try {
      // Verify the signature, so we know that the request came from GitHub
      await verifySignature(payload, signature, keyID, tokenForUser);
    } catch (err) {
      console.error(err);
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Using the token for the user, we can make a request to the GitHub API
    // to get the user's information, like their GitHub login.
    const user = (await fetch("https://api.github.com/user", {
      headers: {
        authorization: `token ${tokenForUser}`,
      },
    }).then((res) => res.json())) as { login: string };

    // Parsing with Zod strips unknown Copilot-specific fields in the request
    // body, which cause OpenAI errors if they're included.
    const json = JSON.parse(payload);
    const input = Input.safeParse(json);

    if (!input.success) {
      return Response.json({ error: "Bad request" }, { status: 400 });
    }

    const messages = input.data.messages;
    console.debug("received input", JSON.stringify(json, null, 4));
    console.debug("received messages", JSON.stringify(messages, null, 4));

    // Determine action
    const capiResponse = await fetch(
      "https://api.githubcopilot.com/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${request.headers.get("X-GitHub-Token")}`,
        },
        body: JSON.stringify({
          stream: false,
          messages: messages,
          model: "gpt-3.5-turbo",
          functions: [{
            "name": "start_indexing",
            "description": "Starts indexing or Re-index the Confluence content"
          }]
        }),
      }
    )
    
    const capiJson = await capiResponse.json() as CapiJson;
    const functionToCall = capiJson.choices[0].message?.function_call?.name;

    if (functionToCall == "start_indexing") {
      startIndexing(user.login);
      // return new readable stream with the message "Indexing started. This might take a while."
      console.log("Indexing started. This might take a while.");

      const data = {
        "id": "chatcmpl-123",
        "object": "chat.completion.chunk",
        "created": (new Date()).getTime(),
        "model": "gpt-3.5-turbo",
        "system_fingerprint": "fp_44709d6fcb",
        "choices": [
          {
            "index": 0,
            "delta": {
              "role":"assistant",
              "content": "Indexing started. This might take a while."
            },
            "logprobs": null,
            "finish_reason":"stop"
          }
        ]
      };

      return new Response(JSON.stringify({data}), { status: 200 });
    }

    const azureSearchService = new AzureSearchService();
    const confluenceData = await azureSearchService.searchContent(messages[messages.length-1].content);

    messages.splice(-1, 0, 
      {
        role: "system",
        content: "Respond based on the following Confluence content"
      },
      {
        role: "system",
        content: JSON.stringify(confluenceData),
      }
    );

    console.log("Message Sent: " + JSON.stringify(messages, null, 4));

    const capiUserResponse = await fetch(
      "https://api.githubcopilot.com/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${request.headers.get("X-GitHub-Token")}`,
        },
        body: JSON.stringify({
          stream: true,
          messages: messages,
          model: "gpt-3.5-turbo",
        }),
      }
    )

    console.log(capiUserResponse);

    return new Response(capiUserResponse.body, { status: 200 } );
  },
});

const GITHUB_KEYS_URI = "https://api.github.com/meta/public_keys/copilot_api";

interface GitHubKeysPayload {
  public_keys: Array<{
    key: string;
    key_identifier: string;
    is_current: boolean;
  }>;
}

// verifySignature verifies the signature of a payload using the public key
// from GitHub's public key API. It fetches that public keys from GitHub's
// public key API, and uses the keyID to find the public key that signed the
// payload. It then verifies the signature using that public key.
async function verifySignature(
  payload: string,
  signature: string,
  keyID: string,
  tokenForUser: string
): Promise<void> {
  if (typeof payload !== "string" || payload.length === 0) {
    throw new Error("Invalid payload");
  }
  if (typeof signature !== "string" || signature.length === 0) {
    throw new Error("Invalid signature");
  }
  if (typeof keyID !== "string" || keyID.length === 0) {
    throw new Error("Invalid keyID");
  }

  const keys = (await fetch(GITHUB_KEYS_URI, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${tokenForUser}`,
    },
  }).then((res) => res.json())) as GitHubKeysPayload;
  const publicKey = keys.public_keys.find((k) => k.key_identifier === keyID);
  if (!publicKey) {
    throw new Error("No public key found matching key identifier");
  }

  const verify = crypto.createVerify("SHA256").update(payload);
  if (!verify.verify(publicKey.key, signature, "base64")) {
    throw new Error("Signature does not match payload");
  }
}

async function startIndexing( username : string) {
  if(isIndexing === false) {
    isIndexing = true;
    try {
      const storageAccountName = process.env.STORAGE_ACCOUNT_NAME;
      const storageAccountKey = process.env.STORAGE_ACCOUNT_KEY;

      if (!storageAccountName || !storageAccountKey) {
        throw new Error('Storage account name or key is missing in environment variables');
      }

      const storageAccount = new StorageAccount(storageAccountName, storageAccountKey);
      
      let confluenceData;
      if(await storageAccount.containerExists(username)) {
        const latestTimestamp = await storageAccount.getLatestTimestamp(username);
        confluenceData = await getConfluenceContent(true, latestTimestamp);
      }else{
        await storageAccount.createContainer(username);
        confluenceData = await getConfluenceContent(false, '');
      }

      const timestampNow = new Date().toISOString();
      storageAccount.uploadJsonData(username, `${username}_${timestampNow}.json`, confluenceData);

      // Call Azure Search Service to index the data
      const azureSearchService = new AzureSearchService();
      await azureSearchService.createDataSource();
      await azureSearchService.createIndex();
      await azureSearchService.createIndexer();
      
    } catch (error) {
      console.error('Error during indexing:', error);
    } finally {
      isIndexing = false;
    }
  }
}