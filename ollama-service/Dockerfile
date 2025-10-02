FROM ollama/ollama:latest

# Download model during build (not runtime)
RUN ollama serve & \
    sleep 10 && \
    ollama pull llama3.2:3b && \
    pkill ollama

EXPOSE 11434

CMD ["ollama", "serve"]


