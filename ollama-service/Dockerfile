FROM ollama/ollama:latest

# Download tinyllama model during build for faster cold starts
RUN ollama serve & \
    sleep 10 && \
    ollama pull tinyllama:latest && \
    pkill ollama

EXPOSE 11434

CMD ["ollama", "serve"]


