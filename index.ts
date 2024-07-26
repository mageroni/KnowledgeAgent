import { OpenAI } from "openai";
import type { ChatCompletionStreamParams } from "openai/lib/ChatCompletionStream.mjs";
import { z } from "zod";

const Message = z.object({
  role: z.string(),
  name: z.string().optional(),
  content: z.string(),
});

const Input = z.object({
  messages: z.array(Message),
});

const openai = new OpenAI({ apiKey: Bun.env.OPENAI_API_KEY });

Bun.serve({
  port: Bun.env.PORT ?? "3000",

  async fetch(request) {
    console.debug("received request", request.url);

    // Do nothing with the OAuth callback, for now. Just return a 200.
    if (new URL(request.url).pathname === "/oauth/callback") {
      console.debug("received oauth callback");
      return Response.json({ ok: true }, { status: 200 });
    }

    // Parsing with Zod strips unknown Copilot-specific fields in the request
    // body, which cause OpenAI errors if they're included.
    const json = await request.json();
    const input = Input.safeParse(json);

    if (!input.success) {
      return Response.json({ error: "Bad request" }, { status: 400 });
    }

    const messages = input.data.messages;
    console.debug("received input", JSON.stringify(json, null, 4));
    console.debug("received messages", JSON.stringify(messages, null, 4));

    // Insert a special hackery system message in our message list.
    messages.splice(-1, 0, {
      role: "system",
      content: "Please use entirely made-up hackery-sounding terminology.",
    });

    const openaiRequestBody = {
      messages,
      model: "gpt-4-1106-preview",
      stream: true,
    };

    const stream = openai.beta.chat.completions.stream(
      openaiRequestBody as ChatCompletionStreamParams,
    );

    console.debug(
      "sending request to OpenAI",
      JSON.stringify(openaiRequestBody, null, 4),
    );

    // Proxy the OpenAI API response right back to the extensibility platform.
    return new Response(
      new ReadableStream({
        async start(controller) {
          stream.on("end", () => {
            controller.close();
          });

          stream.on("chunk", (chunk) =>
            controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`),
          );
        },

        cancel() {
          stream.abort();
        },
      }),
    );
  },
});
