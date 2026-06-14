# Project Overview
This project is a GitHub agent built using Next.js, FastAPI, and LangGraph. It provides a web interface for users to interact with the agent and view its workflow.

## Getting Started
To run the project, follow these steps:
1. Install the required dependencies by running `pip install -r backend/requirements.txt` in the terminal.
2. Create a `.env` file in the `backend` directory and add your GROQ API key, GitHub token, and LangSmith API key.
3. Start the PostgreSQL database by running `docker-compose up` in the terminal.
4. Start the FastAPI server by running `uvicorn backend.api.main:app --host 0.0.0.0 --port 8000` in the terminal.
5. Start the Next.js development server by running `npm run dev` in the terminal.

## Contributing
To contribute to the project, please follow these steps:
1. Fork the repository and create a new branch for your changes.
2. Make your changes and commit them with a descriptive message.
3. Open a pull request and wait for review.

## Resources
* [Next.js Documentation](https://nextjs.org/docs)
* [FastAPI Documentation](https://fastapi.tiangolo.com/)
* [LangGraph Documentation](https://langgraph.dev/)