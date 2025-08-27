import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainIcon, MailIcon, SendIcon, ArrowLeftIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import emailjs from '@emailjs/browser';

export default function ContactPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    title: '',
    message: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Send email via EmailJS
      const result = await emailjs.send(
        'service_synesisai', // You'll need to create this service
        'template_2wqq3ll',
        {
          from_name: formData.name,
          from_email: formData.email,
          message_title: formData.title,
          message: formData.message,
          to_email: 'founders@synesisai-launch.com'
        },
        'cwWhDbwLdrx4d3dI1'
      );
      
      console.log('Email sent successfully:', result);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        title: '',
        message: ''
      });
      
      // Show success message
      alert('Message sent successfully! We\'ll get back to you soon.');
      
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
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
          <span className="text-xl font-semibold text-black font-sans tracking-tight">SynesisAI</span>
        </div>

        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          className="text-gray-600 hover:text-black hover:bg-transparent transition-all duration-200"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-[80vh] px-8">
        <div className="max-w-2xl mx-auto w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-6">
              <MailIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-black mb-4 leading-tight font-sans tracking-tight">
              Get in Touch
            </h1>
            <p className="text-xl text-gray-600 max-w-md mx-auto font-sans">
              Have questions, feedback, or want to collaborate? We'd love to hear from you.
            </p>
          </div>

          {/* Contact Form */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-black font-medium">
                    Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-black focus:ring-black/20 h-12 rounded-xl transition-all duration-200"
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-black font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-black focus:ring-black/20 h-12 rounded-xl transition-all duration-200"
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-black font-medium">
                  Message Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-black focus:ring-black/20 h-12 rounded-xl transition-all duration-200"
                  placeholder="What's this about?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-black font-medium">
                  Message
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  rows={6}
                  className="bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-black focus:ring-black/20 rounded-xl resize-none transition-all duration-200"
                  placeholder="Tell us more about your inquiry, feedback, or collaboration idea..."
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-4 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                    Sending Message...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <SendIcon className="w-5 h-5 mr-2" />
                    Send Message
                  </div>
                )}
              </Button>
            </form>
          </div>

          {/* Additional Info */}
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">
              Prefer to reach us directly?
            </p>
            <div className="flex items-center justify-center gap-6 text-sm">
              <a href="mailto:contact@synesisai.com" className="text-black hover:text-gray-700 transition-colors font-medium">
                contact@synesisai.com
              </a>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">Response within 24 hours</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
