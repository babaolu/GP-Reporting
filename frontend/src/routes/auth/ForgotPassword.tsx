import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { KeyRound, Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 mb-4">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-primary-text font-display mb-1">
            Reset Password
          </h2>
          <p className="text-sm text-gray-500 font-sans">
            Enter your email to receive a password reset link
          </p>
        </div>

        {success ? (
          <div className="space-y-6 text-center animate-fade-in">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex flex-col items-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mb-2" />
              <h3 className="text-lg font-bold text-green-800 font-display">Check your inbox</h3>
              <p className="text-sm text-green-700 mt-1">
                We've sent a password reset link to <strong>{email}</strong>.
              </p>
            </div>
            <Link
              to="/auth/login"
              className="flex items-center justify-center text-sm font-semibold text-primary hover:text-indigo-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-primary-text mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl placeholder-gray-400 text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-all"
                  placeholder="you@yourdomain.com"
                />
              </div>
            </div>

            <div className="space-y-4">
              <button
                type="submit"
                disabled={isSubmitting || !email}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-primary hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                Send Reset Link
              </button>
              
              <Link
                to="/auth/login"
                className="flex items-center justify-center text-sm font-semibold text-primary hover:text-indigo-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
