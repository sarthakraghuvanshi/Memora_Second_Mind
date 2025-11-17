"use client";

import { signIn, useSession } from "next-auth/react";
import { Button } from "@/app/components/ui/button";
import { useRouter } from "next/navigation";
import { Brain, Lock, Zap, Globe, FileText, Image, Mic, Code, Search, Sparkles, Shield, Clock, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-blue-600 animate-pulse" />
          <p className="text-zinc-900">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-stone-100 via-amber-50 to-orange-100 text-zinc-900 overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-200/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-orange-200/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "700ms" }} />
      </div>

      {/* Floating Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Brain className="w-7 h-7 text-blue-600" />
            <span className="text-xl font-bold text-zinc-900">Memora</span>
          </div>
          <div className="flex items-center gap-8">
            <button
              onClick={() => setShowFeaturesModal(true)}
              className="text-sm text-zinc-600 hover:text-zinc-900 transition font-medium"
            >
              Features
            </button>
            <button
              onClick={() => setShowHowItWorksModal(true)}
              className="text-sm text-zinc-600 hover:text-zinc-900 transition font-medium"
            >
              How It Works
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 bg-blue-100 border border-blue-200 rounded-full">
          <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
          <span className="text-sm text-blue-700 font-medium">Your AI-Powered Second Brain</span>
        </div>

        <h1 className="text-7xl md:text-9xl font-bold mb-8 bg-gradient-to-r from-blue-600 via-cyan-600 to-orange-500 bg-clip-text text-transparent leading-tight">
          Memora
        </h1>

        <p className="text-2xl md:text-4xl text-zinc-700 mb-6 max-w-4xl font-light">
          Never forget anything again.
        </p>

        <p className="text-lg md:text-xl text-zinc-600 mb-12 max-w-2xl leading-relaxed">
          Upload any file type. Ask questions in natural language. 
          Get instant, intelligent answers from your encrypted knowledge base.
        </p>

        <Button
          size="lg"
          onClick={() => signIn("google")}
          className="bg-gradient-to-r from-blue-600 to-orange-500 hover:from-blue-700 hover:to-orange-600 text-white px-12 py-8 text-xl rounded-full shadow-xl shadow-blue-300/50 transition-all hover:shadow-blue-400/60 hover:scale-110 hover:-translate-y-1"
        >
          Sign in with Google
        </Button>

        <div className="mt-20 flex flex-wrap justify-center gap-12 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-zinc-700 font-medium">End-to-end encrypted</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-zinc-700 font-medium">Instant AI search</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
              <Brain className="w-5 h-5 text-cyan-600" />
            </div>
            <span className="text-zinc-700 font-medium">50+ file formats</span>
          </div>
        </div>
      </div>

      {/* Features Modal */}
      {showFeaturesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-6xl w-full max-h-[85vh] overflow-y-auto p-8 relative shadow-2xl">
            <button
              onClick={() => setShowFeaturesModal(false)}
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 transition text-zinc-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
              Features
            </h2>
            <p className="text-zinc-600 text-lg mb-10">
              Everything you need in one place
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl hover:border-blue-300 transition-all hover:shadow-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-zinc-900">50+ File Types</h3>
                <p className="text-zinc-600 text-sm">PDF, Word, Excel, PowerPoint, images, audio, code files, and more</p>
              </div>

              <div className="p-6 bg-cyan-50 border border-cyan-100 rounded-2xl hover:border-cyan-300 transition-all hover:shadow-lg">
                <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
                  <Image className="w-6 h-6 text-cyan-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-zinc-900">Vision AI OCR</h3>
                <p className="text-zinc-600 text-sm">Extract text from screenshots, documents, and handwritten notes</p>
              </div>

              <div className="p-6 bg-orange-50 border border-orange-100 rounded-2xl hover:border-orange-300 transition-all hover:shadow-lg">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                  <Mic className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-zinc-900">Audio Transcription</h3>
                <p className="text-zinc-600 text-sm">Transcribe voice memos, meetings, and podcasts automatically</p>
              </div>

              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl hover:border-emerald-300 transition-all hover:shadow-lg">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-zinc-900">Web Scraping</h3>
                <p className="text-zinc-600 text-sm">Save articles, blog posts, and web pages with one click</p>
              </div>

              <div className="p-6 bg-sky-50 border border-sky-100 rounded-2xl hover:border-sky-300 transition-all hover:shadow-lg">
                <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-sky-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-zinc-900">Semantic Search</h3>
                <p className="text-zinc-600 text-sm">Find information by meaning, not just keywords</p>
              </div>

              <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl hover:border-amber-300 transition-all hover:shadow-lg">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-zinc-900">Temporal Queries</h3>
                <p className="text-zinc-600 text-sm">Ask "What did I work on last week?" and get accurate answers</p>
              </div>

              <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl hover:border-indigo-300 transition-all hover:shadow-lg">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-zinc-900">End-to-End Encryption</h3>
                <p className="text-zinc-600 text-sm">AES-256-GCM encryption. Your data is secure and private</p>
              </div>

              <div className="p-6 bg-rose-50 border border-rose-100 rounded-2xl hover:border-rose-300 transition-all hover:shadow-lg">
                <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mb-4">
                  <Code className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-zinc-900">Developer Friendly</h3>
                <p className="text-zinc-600 text-sm">Upload code files, JSON, YAML, and technical documentation</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How It Works Modal */}
      {showHowItWorksModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-8 relative shadow-2xl">
            <button
              onClick={() => setShowHowItWorksModal(false)}
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 transition text-zinc-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-4xl md:text-5xl font-bold mb-12 bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
              How it works
            </h2>

            <div className="space-y-12">
              <div className="flex items-start gap-8">
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-bold mb-3 text-zinc-900">Upload Anything</h3>
                  <p className="text-zinc-600 text-lg leading-relaxed">
                    Drop files, paste URLs, or type notes. Memora handles 50+ file types including PDF, Word, Excel, PowerPoint, images, audio, code files, and web pages.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-8">
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-cyan-500 to-orange-400 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-bold mb-3 text-zinc-900">AI Processing</h3>
                  <p className="text-zinc-600 text-lg leading-relaxed">
                    Content is encrypted with AES-256, chunked intelligently, and embedded using semantic vectors. Dates and metadata are automatically extracted from your content.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-8">
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-bold mb-3 text-zinc-900">Ask Questions</h3>
                  <p className="text-zinc-600 text-lg leading-relaxed">
                    Use natural language to query your knowledge base. Ask temporal questions like "What did I work on last week?" and get accurate, contextual answers instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
