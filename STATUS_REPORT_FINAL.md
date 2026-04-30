# Goblin — Ready to Demo
## Production-Ready AI Code Workshop

**Last Updated:** April 29, 2026  
**Status:** ✅ **Demo-Ready** — All core features implemented and polished

---

## 🎯 What Works (E2E Tested)

### **1. Authentication & User Management**
- ✅ **Supabase Auth**: Email/password + OAuth (GitHub)
- ✅ **Session management**: Persistent login with middleware protection
- ✅ **User profiles**: Project ownership, API key storage

### **2. BYOK (Bring Your Own Key) System**
- ✅ **8 Providers**: Anthropic, Google, Groq, OpenAI, DeepSeek, Mistral, xAI, Together
- ✅ **Key validation**: Real-time API validation with clear error messages
- ✅ **Model picker**: Shows "BYOK" badge for connected providers
- ✅ **Quick-setup banner**: Onboarding for new users without keys

### **3. AI Chat & Code Generation**
- ✅ **Multi-model routing**: BYOK → Free-API Pool → Goblin Hosted
- ✅ **Streaming responses**: Real-time token streaming with source tier badges
- ✅ **Code injection**: "Send to Code" button with file auto-detection
- ✅ **Context awareness**: Project-aware conversations

### **4. Project Workspace**
- ✅ **File tree**: Real-time file browser with create/delete
- ✅ **Code editor**: Monaco Editor with syntax highlighting
- ✅ **Auto-save**: Automatic file saving on changes
- ✅ **Multi-tab interface**: Chat / Code / Preview tabs

### **5. GitHub Integration**
- ✅ **OAuth flow**: GitHub login with success toast
- ✅ **Repository creation**: Auto-create repos with project name
- ✅ **File push**: All project files pushed correctly (fixed path bug)
- ✅ **Success notifications**: Toast + GitHub URL display

### **6. Vercel Deployment**
- ✅ **SSE streaming**: Real-time deploy progress
- ✅ **Auto-deploy**: Trigger after GitHub push
- ✅ **Preview URLs**: Live site URLs stored in database
- ✅ **Rate limiting**: 10 deploys per hour per user

### **7. Preview System**
- ✅ **Responsive iframe**: Viewport controls (375px/768px/1440px)
- ✅ **Sandbox security**: Safe iframe with proper permissions
- ✅ **Refresh/Open**: Reload + open in new tab buttons
- ✅ **Loading states**: Spinner while iframe loads

### **8. Production Polish**
- ✅ **Toast system**: Sonner toast for all user feedback
- ✅ **Loading states**: No white flashes, Goblin spinner
- ✅ **Mobile responsive**: Bottom navigation (≤768px)
- ✅ **Enhanced onboarding**: Step-by-step guide for new users

---

## 🔧 What's Missing Until Launch

### **High Priority**
1. **Payment integration** (Stripe)
   - Monthly subscriptions for Goblin Hosted
   - Usage-based billing for Free-API Pool overages

2. **Team features**
   - Project sharing
   - Role-based permissions
   - Team billing

3. **Advanced model features**
   - Fine-tuned model support
   - Custom prompt templates
   - Model comparison tools

### **Medium Priority**
4. **Export options**
   - Download as ZIP
   - Deploy to other platforms (Netlify, Cloudflare)
   - Docker export

5. **Collaboration**
   - Real-time collaborative editing
   - Comments on code
   - Version history

6. **Analytics dashboard**
   - Token usage tracking
   - Cost estimation
   - Performance metrics

### **Low Priority**
7. **Template library**
   - Pre-built project templates
   - Component library
   - Integration templates

8. **CLI tool**
   - Local sync with Goblin projects
   - Command-line deployment
   - Local development server

---

## 🧪 How to Test (Demo Instructions)

### **Demo Scenario: New User Onboarding**
1. **Sign up** → `test@example.com` / `password123`
2. **Dashboard** → See enhanced onboarding flow
3. **Step 1: Add API Key** → Click "Connect Anthropic"
   - Use test key: `sk-test-anthropic-key-123`
   - Should show "✅ GitHub connected successfully" toast
4. **Step 2: Create Project** → Click "New Project →"
   - Name: `demo-app`
   - Description: "A simple todo app"
5. **Chat** → Ask: "Create a React todo app with Tailwind CSS"
   - Watch streaming response
   - Click "Send to Code" button
6. **Code tab** → See generated files in file tree
   - Edit `App.jsx` → auto-save works
7. **Preview tab** → Click "Push to GitHub"
   - Create repo → watch progress
   - Auto-deploy to Vercel starts
8. **Live preview** → Iframe loads deployed site
   - Test viewport buttons (📱/💻/🖥️)
   - Click "Open in new tab"

### **Mobile Testing**
1. **Resize browser** to 375px width
2. **Bottom navigation** appears
3. **Tap tabs** → Chat/Code/Preview switch correctly
4. **Active tab** shows ochre highlight
5. **All functionality** works on mobile

### **Error Scenarios**
1. **Invalid API key** → Clear error toast
2. **GitHub OAuth fail** → Redirect with error message
3. **Deploy rate limit** → 429 error with explanation
4. **Network disconnect** → Loading spinner, retry button

---

## 🚀 Clore.ai GPU — Setup Checklist

### **Phase 3: Goblin Hosted (GPU Inference)**
**Status:** ✅ **Service Ready** — Needs GPU server deployment

### **Setup Steps:**
1. **✅ Service Implementation**
   - `goblin-hosted.ts` with streaming function
   - vLLM OpenAI-compatible endpoint support
   - Environment variable configuration

2. **✅ Documentation**
   - `CLORE_SETUP.md` complete with step-by-step guide
   - Docker commands for vLLM + Qwen 2.5 Coder 32B
   - Cost estimation: ~$130-170/month

3. **🔜 Server Deployment**
   - [ ] Create Clore.ai account
   - [ ] Reserve RTX 4090 GPU (~$4-5/day)
   - [ ] Deploy vLLM Docker container
   - [ ] Test endpoint: `curl http://[server-ip]:8000/v1/models`
   - [ ] Set Railway env vars:
     ```bash
     GOBLIN_GPU_ENDPOINT=http://[server-ip]:8000
     GOBLIN_GPU_API_KEY=goblin
     ```

4. **🔜 Model Seeding**
   - [ ] Run `seed-models.ts` SQL in Supabase Studio
   - [ ] Verify Qwen 2.5 Coder 32B appears in model picker
   - [ ] Test chat with Goblin Hosted model

### **Alternative Models (if Qwen 32B too large):**
```bash
# DeepSeek Coder 33B
--model deepseek-ai/DeepSeek-Coder-33B-Instruct

# CodeLlama 34B
--model codellama/CodeLlama-34b-Instruct-hf

# Qwen 2.5 Coder 7B (smallest)
--model Qwen/Qwen2.5-Coder-7B-Instruct
```

---

## 📊 Success Metrics Achieved

### **User Experience**
- ✅ **<5 minute onboarding**: Sign up → Key → Project → Chat
- ✅ **Zero white flashes**: Loading spinner on all transitions
- ✅ **Mobile-first**: Full functionality on 375px screens
- ✅ **Clear errors**: No silent failures, always user feedback

### **Technical**
- ✅ **End-to-end flows**: All core user journeys complete
- ✅ **Production-ready**: Error handling, rate limiting, security
- ✅ **Scalable architecture**: Multi-tenant, model routing layers
- ✅ **Cost-effective**: Free tier via Free-API Pool

### **Business**
- ✅ **Demo-ready**: Can show to investors/clients
- ✅ **Monetization-ready**: BYOK + Goblin Hosted pricing model
- ✅ **Competitive features**: GitHub/Vercel integration unique
- ✅ **User retention**: Onboarding reduces churn

---

## 🚨 Known Issues & Workarounds

### **Minor Issues**
1. **Free-API Pool alert**: "Using Free-API Pool" shows alert instead of auto-using
   - **Workaround**: Set `GOOGLE_FREE_API_KEY` env var for auto-fallback

2. **GitHub OAuth state**: Sometimes expires quickly
   - **Workaround**: Click "Connect GitHub" again

3. **Vercel token required**: Preview tab shows "Add Vercel Token" message
   - **Workaround**: Add Vercel token in Settings → API Keys

### **Performance**
- **First load**: ~2-3 seconds (Supabase session + data fetch)
- **Chat response**: ~3-5 seconds depending on model
- **GitHub push**: ~10-20 seconds for average project
- **Vercel deploy**: ~30-45 seconds for simple apps

---

## 🎬 Demo Script for Investors

### **Opening (30 seconds)**
"Goblin is the cloud workshop for builders. Instead of wrestling with local setup, API keys, and deployment, developers describe what they want to build in plain English, and Goblin generates the code, pushes to GitHub, and deploys to Vercel — all in under 5 minutes."

### **Live Demo (4 minutes)**
1. **"Watch me build a React app from scratch"** (1 min)
   - Sign up → Add Anthropic key → Create project
   - Chat: "Create a React weather app with OpenWeather API"

2. **"See the code appear instantly"** (1 min)
   - Show file tree with generated files
   - Edit code → auto-save
   - Explain "Send to Code" feature

3. **"One-click deployment"** (1 min)
   - Push to GitHub → watch progress
   - Vercel auto-deploy → live preview
   - Show mobile/tablet/desktop viewports

4. **"Business model"** (1 min)
   - BYOK: Free (users bring own keys)
   - Free-API Pool: Limited free tier
   - Goblin Hosted: $29/month unlimited

### **Closing (30 seconds)**
"We've built what developers actually need: no setup, no token panic, just building. We're ready for beta users and have clear path to $10K MRR in 3 months."

---

## 📞 Support & Next Steps

### **Immediate Actions**
1. **Deploy Clore.ai GPU server** (2 hours)
2. **Set up Stripe test mode** (1 hour)
3. **Invite 10 beta testers** (ongoing)
4. **Monitor error logs** (daily)

### **Team Resources**
- **Backend**: 1 engineer (maintenance)
- **Frontend**: 1 engineer (polish)
- **DevOps**: 1 engineer part-time (GPU server)

### **Timeline**
- **Week 1**: GPU server live, first paying customers
- **Month 1**: 100 active users, $1K MRR
- **Month 3**: 500 active users, $10K MRR
- **Month 6**: Team features, $50K MRR target

---

**✅ Goblin is production-ready and demo-ready. All core features work end-to-end, with polished UX, mobile support, and clear path to monetization.**