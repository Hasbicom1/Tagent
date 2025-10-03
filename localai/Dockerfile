FROM localai/localai:latest-cpu
RUN mkdir -p /models && cd /models && \
    wget https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf
EXPOSE 11434
CMD ["localai", "run", "--models-path", "/models", "--address", "0.0.0.0:11434"]


