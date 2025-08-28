import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrainIcon,
  BookmarkIcon,
  MessageSquareIcon,
  FolderIcon,
  ArrowRightIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import blink from '../blink/client';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const handleGetStarted = async () => {
    try {
      await blink.auth.login();
      // After successful login, redirect to dashboard
      navigate('/');
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Subtle dotted background texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)',
        backgroundSize: '20px 20px',
      }}></div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <BrainIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-black font-sans">SynesisAI</span>
        </div>

        <div className="flex items-center gap-8">
          <a href="/contact" className="text-gray-600 hover:text-black transition-colors">Join Waitlist!</a>
          <Button
            onClick={handleGetStarted}
            className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
            disabled={true}
          >
            Coming Soon...
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 flex items-center justify-center min-h-[80vh] px-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Side - Content */}
          <div className="space-y-8">
            <h1 className="text-6xl lg:text-7xl font-bold text-black leading-tight font-sans tracking-tight">
              The AI Conversation
              <br />
              <span className="text-black">Organizer</span>
            </h1>

            <div className="space-y-4">
              <div className="text-xl font-semibold text-black font-sans tracking-wide">ORGANIZE 3X FASTER</div>
              <div className="text-xl font-semibold text-black font-sans tracking-wide">100% CONVERSATION CONTEXT</div>
              <div className="text-xl font-semibold text-black font-sans tracking-wide">SMART BOOKMARKING</div>
            </div>

            <div className="space-y-4">
              <Button
                size="lg"
                onClick={handleGetStarted}
                className="bg-black hover:bg-gray-800 text-white px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 group"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                Coming Soon... Join Waitlist!
                <ArrowRightIcon className={`w-5 h-5 ml-2 transition-transform duration-300 ${isHovered ? 'translate-x-1' : ''}`} />
              </Button>

              <p className="text-gray-600 text-sm">
                No Payment Required
              </p>
            </div>
          </div>

          {/* Right Side - Visual */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Main visual element - abstract brain/network */}
              <div className="w-80 h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 opacity-50"></div>

                {/* Network nodes */}
                <div className="relative z-10 grid grid-cols-3 gap-8">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-4 h-4 bg-black rounded-full animate-pulse" style={{
                      animationDelay: `${i * 0.1}s`,
                    }}></div>
                  ))}
                </div>

                {/* Connecting lines */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 320">
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#000" stopOpacity="0.1"/>
                      <stop offset="100%" stopColor="#000" stopOpacity="0.3"/>
                    </linearGradient>
                  </defs>
                  <path d="M80 80 Q160 40 240 80" stroke="url(#lineGradient)" strokeWidth="2" fill="none"/>
                  <path d="M80 160 Q160 120 240 160" stroke="url(#lineGradient)" strokeWidth="2" fill="none"/>
                  <path d="M80 240 Q160 200 240 240" stroke="url(#lineGradient)" strokeWidth="2" fill="none"/>
                  <path d="M40 80 Q80 120 120 160" stroke="url(#lineGradient)" strokeWidth="2" fill="none"/>
                  <path d="M200 160 Q240 200 280 240" stroke="url(#lineGradient)" strokeWidth="2" fill="none"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Partner Section */}
      <div className="relative z-10 px-8 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* <p className="text-gray-600 mb-8">
            1000+ DEVELOPERS USE SYNESISAI TO ORGANIZE FASTER. SEE WHY TEAMS CHOOSE SYNESISAI →
          </p> */}

          {/* Partner logos placeholder */}
          {/* <div className="grid grid-cols-5 gap-8 opacity-40">
            {['Brex', 'Substack', 'BILT', 'Podium', 'PostHog'].map((company) => (
              <div key={company} className="text-gray-400 font-medium text-sm">
                {company}
              </div>
            ))}
          </div> */}
        </div>
      </div>
    </div>
  );
}
