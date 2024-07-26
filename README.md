# hacker-agent

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
