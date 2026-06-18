import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/api';
import { KeyRound, User, Send, CheckCircle2, ArrowRight, Loader2, Info } from 'lucide-react';

export const Onboarding: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Change Password states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Complete Profile states
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Step 3: Telegram Linking states
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramCodeExpiry, setTelegramCodeExpiry] = useState<string | null>(null);
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'GracePlaceReportBot';

  // Password Validation
  const isPasswordValid = (pw: string) => {
    const minLength = pw.length >= 8;
    const hasNumber = /\d/.test(pw);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':",\\|.<>\/?]/.test(pw);
    return minLength && hasNumber && hasSpecial;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (!isPasswordValid(password)) {
      setErrorMsg('Password must be 8+ characters, include at least one number and one special character.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setStep(2);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during password update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName || !phoneNumber) {
      setErrorMsg('Full Name and Phone Number are required.');
      return;
    }

    setStep(3);
    // Generate Telegram link code when transitioning to Step 3
    generateTelegramCode();
  };

  const generateTelegramCode = async () => {
    setIsLoadingCode(true);
    setErrorMsg(null);
    try {
      const response = await apiPost<{ code: string; expiresAt: string }>('/telegram/link');
      setTelegramCode(response.code);
      setTelegramCodeExpiry(new Date(response.expiresAt).toLocaleTimeString());
    } catch (err: any) {
      console.error('Failed to generate Telegram linking code:', err);
      // We don't block onboarding if Telegram fails, since it is optional.
    } finally {
      setIsLoadingCode(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Complete onboarding in backend
      await apiPost('/auth/onboarding', {
        fullName,
        phoneNumber,
        avatarUrl: avatarUrl || null
      });

      // Refresh authentication profile context
      await refreshProfile();

      // Redirect to appropriate dashboard
      if (user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/unit-head');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        
        {/* Progress Header */}
        <div className="bg-primary px-8 py-6 text-white text-center">
          <h2 className="text-2xl font-bold font-display">Account Activation</h2>
          <p className="text-sm text-indigo-200 mt-1 font-sans">
            Please complete these steps to configure your account.
          </p>

          <div className="flex items-center justify-center space-x-4 mt-6">
            <div className={`flex items-center space-x-2 text-xs font-semibold ${step >= 1 ? 'text-white' : 'text-indigo-300'}`}>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step > 1 ? 'bg-green-custom text-white' : step === 1 ? 'bg-accent text-white' : 'bg-indigo-800'}`}>
                {step > 1 ? '✓' : '1'}
              </span>
              <span>Change Password</span>
            </div>
            <div className="h-0.5 w-6 bg-indigo-700" />
            <div className={`flex items-center space-x-2 text-xs font-semibold ${step >= 2 ? 'text-white' : 'text-indigo-300'}`}>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step > 2 ? 'bg-green-custom text-white' : step === 2 ? 'bg-accent text-white' : 'bg-indigo-800'}`}>
                {step > 2 ? '✓' : '2'}
              </span>
              <span>Complete Profile</span>
            </div>
            <div className="h-0.5 w-6 bg-indigo-700" />
            <div className={`flex items-center space-x-2 text-xs font-semibold ${step >= 3 ? 'text-white' : 'text-indigo-300'}`}>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step === 3 ? 'bg-accent text-white' : 'bg-indigo-800'}`}>
                3
              </span>
              <span>Link Telegram</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-8">
          {errorMsg && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl text-sm text-red-700 mb-6">
              {errorMsg}
            </div>
          )}

          {/* STEP 1: CHANGE PASSWORD */}
          {step === 1 && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="flex items-center space-x-3 text-primary-text mb-2">
                <KeyRound className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-bold font-display">Step 1: Set New Password</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4 font-sans">
                You must replace the temporary password generated by the administration.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="••••••••"
                  />
                  <div className="mt-2 text-xs text-gray-500 flex flex-col space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="font-semibold flex items-center text-primary-text mb-1">
                      <Info className="h-3.5 w-3.5 mr-1 text-primary" /> Password Criteria:
                    </span>
                    <span className={password.length >= 8 ? 'text-green-600' : 'text-red-500'}>
                      • At least 8 characters
                    </span>
                    <span className={/\d/.test(password) ? 'text-green-600' : 'text-red-500'}>
                      • Contains at least one number (0-9)
                    </span>
                    <span className={/[!@#$%^&*()_+\-=\[\]{};':",\\|.<>\/?]/.test(password) ? 'text-green-600' : 'text-red-500'}>
                      • Contains at least one special character (!@#$%^&*)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-indigo-800 disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Next Step <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </form>
          )}

          {/* STEP 2: COMPLETE PROFILE */}
          {step === 2 && (
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="flex items-center space-x-3 text-primary-text mb-2">
                <User className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-bold font-display">Step 2: Profile Details</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4 font-sans">
                Tell us a bit about yourself. Phone number is required for urgent coordinator reminders.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="E.g., John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="E.g., +234..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">Profile Image URL (Optional)</label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="https://example.com/photo.jpg"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-indigo-800 transition-colors flex items-center justify-center cursor-pointer"
              >
                Next Step <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </form>
          )}

          {/* STEP 3: LINK TELEGRAM */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-primary-text mb-2">
                <Send className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-bold font-display">Step 3: Link Telegram Account</h3>
              </div>
              <p className="text-sm text-gray-500 font-sans">
                Link your Telegram account to receive automated report reminders directly in your chat.
              </p>

              {isLoadingCode ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <span className="text-sm text-gray-500 mt-2">Generating code...</span>
                </div>
              ) : telegramCode ? (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center space-y-4">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider block">One-Time Verification Code</span>
                  <div className="text-4xl font-mono font-bold tracking-widest text-primary-text bg-white py-3 px-6 rounded-xl border border-indigo-100 inline-block">
                    {telegramCode}
                  </div>
                  <p className="text-xs text-gray-500">
                    Expires at <strong>{telegramCodeExpiry}</strong> (valid for 10 minutes)
                  </p>
                  
                  <div className="text-left text-sm text-primary-text space-y-2 mt-4 border-t border-indigo-100 pt-4">
                    <span className="font-semibold text-xs text-gray-600 block">Instructions:</span>
                    <p>1. Open Telegram and search for <strong>@{botUsername}</strong>.</p>
                    <p>2. Send <code>/start</code> to initialize the bot chat.</p>
                    <p>3. Copy the 6-digit verification code above and send it to the bot chat.</p>
                  </div>
                  
                  <button
                    onClick={generateTelegramCode}
                    className="text-xs font-semibold text-primary hover:text-indigo-800 transition-colors underline cursor-pointer"
                  >
                    Regenerate Link Code
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  Failed to fetch Telegram link code. You can link your account later in Settings.
                </div>
              )}

              <div className="space-y-4 pt-4">
                <button
                  onClick={handleCompleteOnboarding}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-indigo-800 disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Finish Onboarding
                </button>
                
                <button
                  onClick={handleCompleteOnboarding}
                  disabled={isSubmitting}
                  className="w-full py-2 text-sm font-semibold text-gray-600 hover:text-primary-text transition-colors cursor-pointer"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
