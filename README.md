# Shift Control

Shift Control is a self-hosted, modular automation hub designed to manage e-commerce businesses and content distribution. It features a modern, responsive Command Center (Chat UI) that interfaces with an n8n workflow engine backend.

## Features

*   **Command Center UI:** A responsive, mobile-friendly chat interface built with React, Tailwind CSS, and Lucide Icons.
*   **Modular Automation:** Powered by n8n, allowing you to snap in new "skills" or agents as your needs grow.
*   **LLM Routing:** Uses OpenRouter (Claude 3.5 Sonnet, Gemini, etc.) to classify user intent and route commands to the correct agent.
*   **Pre-built Agents:**
    *   **Orchestrator:** The brain that routes requests.
    *   **Shopify Manager:** Updates product listings via the Shopify GraphQL API.
    *   **Social Publisher:** Publishes media and captions to Instagram/Facebook via the Meta Graph API.
*   **Self-Hosted:** Fully containerized with Docker and Docker Compose for easy deployment on any Linux VPS.

## Tech Stack

*   **Frontend:** React 18, Vite, Tailwind CSS v4, TypeScript
*   **Backend/Workflow Engine:** n8n
*   **Database:** PostgreSQL 16 (for n8n state and credentials)
*   **AI/LLM:** OpenRouter API

## Project Structure

```text
.
├── docker-compose.yml       # Production deployment orchestration
├── Dockerfile               # Frontend production build image
├── .env.example.vps         # Template for VPS environment variables
├── n8n-workflows/           # Exported n8n agent blueprints (JSON)
├── src/                     # React frontend source code
│   ├── components/          # UI Components (ChatArea, Sidebar)
│   ├── lib/                 # Utility functions
│   ├── App.tsx              # Main application layout
│   └── main.tsx             # React entry point
└── docs/                    # Additional documentation
```

## Local Development Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd shift-control
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Copy `.env.example` to `.env` and fill in any required local variables.

4.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The UI will be available at `http://localhost:3000`.

## VPS Deployment (Production)

1.  **Prepare the VPS:**
    Ensure Docker and Docker Compose are installed on your Linux server.

2.  **Clone the repository to your VPS:**
    ```bash
    git clone <your-repo-url> shift-control
    cd shift-control
    ```

3.  **Configure Environment Variables:**
    ```bash
    cp .env.example.vps .env
    nano .env
    ```
    *Fill in your secure passwords, OpenRouter API key, and domain details.*

4.  **Deploy the Stack:**
    ```bash
    sudo docker compose up -d --build
    ```

5.  **Access the Services:**
    *   **Command Center UI:** `http://<YOUR_VPS_IP>:3000`
    *   **n8n Dashboard:** `http://<YOUR_VPS_IP>:5678`

## Setting up n8n Workflows

Once n8n is running on your VPS:
1. Log in to the n8n dashboard.
2. Go to **Workflows** -> **Add Workflow**.
3. Click the options menu (three dots) in the top right and select **Import from File**.
4. Import the JSON files located in the `n8n-workflows/` directory in this order:
   * `1-orchestrator-agent.json`
   * `2-shopify-manager-agent.json`
   * `3-social-publisher-agent.json`
5. Update the Webhook node in the Orchestrator to "Production" mode and activate the workflow.
6. Add your OpenRouter, Shopify, and Meta credentials in the n8n Credentials tab and link them to the respective HTTP Request nodes.
