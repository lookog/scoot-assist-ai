import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [step, setStep] = useState<'auth' | 'otp'>('auth');
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isDev = import.meta.env.DEV;

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If it doesn't start with +, add country code
    if (!phone.startsWith('+')) {
      // Default to India (+91) if no country code
      if (cleaned.length === 10) {
        return `+91${cleaned}`;
      }
      // Default to US (+1) for 10-digit numbers
      if (cleaned.length === 10) {
        return `+1${cleaned}`;
      }
      return `+${cleaned}`;
    }
    return phone;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: 'sms'
        }
      });

      if (error) throw error;

      toast({
        title: "OTP Sent",
        description: "Please check your phone for the verification code.",
      });
      setStep('otp');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message.includes('phone provider') 
          ? 'SMS not supported for this number. Please try email authentication.'
          : error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Clean up any existing auth state first
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        if (error) throw error;
        
        toast({
          title: "Account created successfully!",
          description: "You have been automatically signed in.",
        });

        // Force page refresh to ensure clean state
        if (data.user) {
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        }
      } else {
        // Attempt global sign out first to clear any stale sessions
        try {
          await supabase.auth.signOut({ scope: 'global' });
        } catch (err) {
          // Continue even if this fails
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        toast({
          title: "Welcome back!",
          description: "You have been signed in successfully.",
        });

        // Force page refresh to ensure clean state
        if (data.user) {
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Development bypass
      if (isDev && otp === '123456') {
        toast({
          title: "Development Mode",
          description: "Using development bypass code.",
        });
        // Clean state and redirect
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
            localStorage.removeItem(key);
          }
        });
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
        return;
      }

      const formattedPhone = formatPhoneNumber(phoneNumber);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms'
      });

      if (error) throw error;

      toast({
        title: "Welcome!",
        description: "You have been signed in successfully.",
      });

      // Force page refresh to ensure clean state
      if (data.user) {
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      }
    } catch (error: any) {
      toast({
        title: "Invalid Code",
        description: "Please check your verification code and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('auth');
    setOtp('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {step === 'auth' ? 'Welcome to ScootAssist' : 'Enter Verification Code'}
          </CardTitle>
          <p className="text-muted-foreground">
            {step === 'auth' 
              ? 'Sign in to get started' 
              : authMethod === 'phone' 
                ? `We sent a code to ${phoneNumber}`
                : 'Enter the verification code'
            }
          </p>
        </CardHeader>
        <CardContent>
          {step === 'auth' ? (
            <Tabs value={authMethod} onValueChange={(value) => setAuthMethod(value as 'phone' | 'email')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="phone">Phone</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>
              
              <TabsContent value="phone" className="space-y-4 mt-4">
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium mb-2">
                      Mobile Number
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210 or +1 555 123 4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Include country code (e.g., +91 for India, +1 for US)
                    </p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !phoneNumber}
                  >
                    {loading ? 'Sending...' : 'Send Verification Code'}
                  </Button>
                  {isDev && (
                    <p className="text-xs text-orange-600 text-center">
                      Dev mode: Use code 123456 to bypass SMS
                    </p>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="email" className="space-y-4 mt-4">
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-2">
                      Password
                    </label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !email || !password}
                  >
                    {loading ? (isSignUp ? 'Creating Account...' : 'Signing In...') : (isSignUp ? 'Create Account' : 'Sign In')}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {isDev && (
                <p className="text-xs text-orange-600 text-center">
                  Development mode: Enter 123456 to bypass
                </p>
              )}
              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={handleBack}
                >
                  Back
                </Button>
              </div>
            </form>
          )}
          
          {step === 'auth' && (
            <div className="mt-6 pt-4 border-t border-border">
              <Button 
                variant="link" 
                className="w-full text-sm text-muted-foreground"
                onClick={() => window.location.href = '/admin/auth'}
              >
                Admin Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;