# Clore.ai GPU Server Setup for Goblin Hosted (Phase 3)

This guide explains how to set up a GPU server on Clore.ai to power Goblin's Phase 3 "Goblin Hosted" models.

## 1. Create Account on Clore.ai

1. Go to [clore.ai](https://clore.ai)
2. Sign up for an account
3. Add payment method (credit card or crypto)
4. Verify your account

## 2. Reserve RTX 4090 GPU

1. In the Clore.ai dashboard, go to "Rent GPU"
2. Filter for:
   - GPU Type: RTX 4090
   - Location: Choose closest to your users (EU/US/Asia)
   - Price: ~$4-5 per day
3. Select a server with at least 24GB VRAM
4. Click "Rent Now" and confirm

## 3. Deploy vLLM Docker Container

Once your GPU server is provisioned, SSH into it:

```bash
ssh root@[server-ip]
```

Install Docker if not already installed:

```bash
# For Ubuntu/Debian
apt-get update
apt-get install -y docker.io
systemctl start docker
systemctl enable docker

# Add user to docker group
usermod -aG docker $USER
```

Run the vLLM container with Qwen 2.5 Coder 32B:

```bash
docker run -d \
  --gpus all \
  -p 8000:8000 \
  --name vllm-goblin \
  vllm/vllm-openai:latest \
  --model Qwen/Qwen2.5-Coder-32B-Instruct \
  --quantization awq \
  --max-model-len 32768 \
  --api-key goblin \
  --served-model-name qwen2.5-coder-32b-instruct
```

**Parameters explained:**
- `--model Qwen/Qwen2.5-Coder-32B-Instruct`: Best coding model for Goblin
- `--quantization awq`: 4-bit quantization (fits in 24GB VRAM)
- `--max-model-len 32768`: 32K context window
- `--api-key goblin`: Simple authentication
- `--served-model-name`: Name exposed via OpenAI-compatible API

## 4. Test the Endpoint

From your local machine, test the endpoint:

```bash
curl http://[server-ip]:8000/v1/models
```

Should return:
```json
{
  "object": "list",
  "data": [
    {
      "id": "qwen2.5-coder-32b-instruct",
      "object": "model",
      "created": 1234567890,
      "owned_by": "vllm"
    }
  ]
}
```

Test chat completion:

```bash
curl http://[server-ip]:8000/v1/chat/completions \
  -H "Authorization: Bearer goblin" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-coder-32b-instruct",
    "messages": [
      {"role": "user", "content": "Write a hello world in Python"}
    ],
    "max_tokens": 100
  }'
```

## 5. Configure Goblin Backend

Add these environment variables to your Railway/Railway.app project:

```bash
GOBLIN_GPU_ENDPOINT=http://[server-ip]:8000
GOBLIN_GPU_API_KEY=goblin
```

**For Railway:**
```bash
railway variables set GOBLIN_GPU_ENDPOINT http://[server-ip]:8000
railway variables set GOBLIN_GPU_API_KEY goblin
```

## 6. Verify Goblin Hosted is Active

1. Restart your Goblin API
2. Check logs for "Goblin Hosted configured"
3. Test via API:
   ```bash
   curl -H "Authorization: Bearer [user-token]" \
     https://your-api.railway.app/api/models
   ```
   Should include models with `layer: 'goblin_hosted'`

## 7. Monitoring & Maintenance

### Check GPU Usage:
```bash
# On the GPU server
nvidia-smi
watch -n 1 nvidia-smi
```

### View Container Logs:
```bash
docker logs -f vllm-goblin
```

### Restart Container:
```bash
docker restart vllm-goblin
```

### Update Model:
```bash
docker stop vllm-goblin
docker rm vllm-goblin
# Run new container with updated model
```

## 8. Cost Optimization

- **Auto-stop**: Configure Clore.ai to stop server during off-hours
- **Spot instances**: Use spot pricing for ~30% discount
- **Load balancing**: Route traffic to cheapest available region
- **Cache responses**: Implement response caching for common queries

## 9. Troubleshooting

### "Connection refused"
- Check firewall: `ufw status`
- Open port 8000: `ufw allow 8000`
- Verify container is running: `docker ps`

### "Out of memory"
- Reduce `--max-model-len` to 16384
- Use smaller model: `Qwen/Qwen2.5-Coder-7B-Instruct`
- Increase quantization: `--quantization gptq`

### "Slow responses"
- Check GPU utilization: `nvidia-smi`
- Consider upgrading to RTX 4090 with 24GB VRAM
- Enable continuous batching in vLLM

## 10. Security Considerations

1. **Change default API key**: Use a strong random key
2. **Enable HTTPS**: Use Cloudflare Tunnel or reverse proxy
3. **IP whitelisting**: Restrict to Goblin API IPs
4. **Rate limiting**: Implement in vLLM or at proxy level
5. **Regular updates**: Keep vLLM and Docker updated

## 11. Alternative Models

If Qwen 2.5 Coder 32B is too large, try:

```bash
# DeepSeek Coder 33B (excellent for coding)
--model deepseek-ai/DeepSeek-Coder-33B-Instruct

# CodeLlama 34B (good balance)
--model codellama/CodeLlama-34b-Instruct-hf

# Smaller option: Qwen 2.5 Coder 7B
--model Qwen/Qwen2.5-Coder-7B-Instruct
```

## 12. Support

- **Clore.ai support**: support@clore.ai
- **vLLM documentation**: https://docs.vllm.ai
- **Goblin Discord**: [link to your Discord]
- **GitHub Issues**: [link to your repo]

---

**Estimated Monthly Cost:**
- RTX 4090: $120-150/month
- Bandwidth: $10-20/month
- **Total: ~$130-170/month**

This provides unlimited inference for all Goblin users with no per-token costs!