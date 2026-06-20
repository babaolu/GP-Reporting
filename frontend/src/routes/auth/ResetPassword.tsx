import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { KeyRound, CheckCircle2, Loader2 } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navigate = useNavigate();

  const isPasswordValid = (pw: string) => {
    return pw.length >= 8 && /\d/.test(pw) && /[!@#$%^&*()_+\-=\[\]{};':",\\|.<>\/?]/.test(pw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (!isPasswordValid(password)) {
      setErrorMsg('Password must be 8+ characters and contain a number and a special character.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          navigate('/auth/login');
        }, 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 mb-4">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-primary-text font-display mb-1">
            Set New Password
          </h2>
          <p className="text-sm text-gray-500 font-sans">
            Enter your new secure password details below
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3 animate-fade-in">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
            <h3 className="text-lg font-bold text-green-800 font-display">Password updated!</h3>
            <p className="text-sm text-green-700">
              Your password has been changed successfully. Redirecting you to login page...
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 h-11 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 h-11 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-primary text-white font-semibold rounded-xl hover:bg-indigo-800 disabled:opacity-50 transition-colors flex items-center justify-center cursor-pointer"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
