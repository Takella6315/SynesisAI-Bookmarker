import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrainIcon,
  ArrowLeftIcon,
  SparklesIcon,
  ShieldIcon,
  ZapIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import blink from '../blink/client';

export default function AuthPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      if (state.user) {
        setUser(state.user);
        // Don't automatically redirect - let the handleGoogleAuth function handle it
      }
    });
    return unsubscribe;
  }, [navigate]);

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      await blink.auth.login();
      // After successful login, redirect to dashboard
      navigate('/');
    } catch (error) {
      console.error('Authentication failed:', error);
      setIsLoading(false);
    }
  };

  const handleBackToLanding = () => {
    navigate('/landing');
  };

  const benefits = [
    {
      icon: ShieldIcon,
      title: 'Secure & Private',
      description: 'Your conversations are encrypted and never shared with third parties',
    },
    {
      icon: ZapIcon,
      title: 'Lightning Fast',
      description: 'Instant responses powered by the latest AI models',
    },
    {
      icon: SparklesIcon,
      title: 'Smart Organization',
      description: 'AI automatically organizes your chats into meaningful topics',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Subtle dotted background texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)',
        backgroundSize: '20px 20px',
      }}></div>

      <div className="relative z-10 max-w-6xl mx-auto px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[80vh]">
          {/* Left Side - Auth Form */}
          <div className="space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToLanding}
                className="text-gray-600 hover:text-black hover:bg-gray-100 p-2 rounded-lg"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to landing
              </Button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
                  <BrainIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-black">Welcome to SynesisAI</h1>
                  <p className="text-gray-600">Sign in to continue organizing your AI conversations</p>
                </div>
              </div>
            </div>

            {/* Auth Buttons */}
            <div className="space-y-4">
              <Button
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full bg-black hover:bg-gray-800 text-white py-4 text-lg font-medium rounded-lg border-2 border-black hover:border-gray-800 transition-all duration-200"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                ) : (
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continue with Google
              </Button>

              <Button
                variant="outline"
                className="w-full border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 py-4 text-lg font-medium rounded-lg transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
              </Button>
            </div>

            {/* Terms */}
            <p className="text-center text-sm text-gray-500">
              By continuing, you agree to our{' '}
              <a href="#" className="text-black hover:underline font-medium">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-black hover:underline font-medium">Privacy Policy</a>
            </p>
          </div>

          {/* Right Side - Benefits */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-black">
                Join thousands of developers who are already organizing their AI conversations
              </h2>

              <div className="space-y-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-black mb-1">{benefit.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <SparklesIcon className="w-5 h-5 text-black" />
                <span className="font-semibold text-black">What you'll get:</span>
              </div>
              <ul className="text-gray-700 space-y-2 text-sm">
                <li>• Unlimited AI conversations</li>
                <li>• Automatic topic organization</li>
                <li>• Advanced bookmarking system</li>
                <li>• Conversation memory & context</li>
                <li>• File-system style navigation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
