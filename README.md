# Knowledge Agent

This extension enables Copilot to draw data from various specified sources, such as Confluence and SharePoint. In the process an Azure Search Service is used to index the data and users can utilize Copilot to answer questions based on the indexed data. Additionally, users have the capability to re-index the data source to reflect any updates in the underlying information.

This video demonstrate an example using Confluence as the underlying source:

https://github.com/user-attachments/assets/ad5f30b6-e232-47a5-b2ae-1fb710d10044



## Development

Install dependencies:

```bash
bun install
```

Create an OpenAI API key, and put it in a .env file:

```bash
cp .env.example .env
echo "$OPENAI_API_KEY" >> .env
```

To run:

```bash
bun dev
```

## Deployment

Create a Fly.io app:

```bash
fly launch
```

Set the OpenAI API key:

```bash
fly secrets set OPENAI_API_KEY=$OPENAI_API_KEY
```

Deploy to Fly.io:

```bash
fly deploy
```

This project was created using `bun init` in bun v1.0.22. [Bun](https://bun.sh)
is a fast all-in-one JavaScript runtime.
