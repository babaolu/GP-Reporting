import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/api';
import { 
  User, 
  KeyRound, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Mail, 
  Loader2 
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'notifications'>('profile');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile fields
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Telegram Code states
  const [tgCode, setTgCode] = useState<string | null>(null);
  const [tgExpiry, setTgExpiry] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Preferences
  const [emailNotif, setEmailNotif] = useState(true);

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'GracePlaceReportBot';

  // Synchronize field states with profile context
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhoneNumber(user.phone_number || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  // Telegram linkage checking poll (fires every 5 seconds if linking code active)
  useEffect(() => {
    let intervalId: any;
    if (isPolling && user && !user.telegram_linked) {
      intervalId = setInterval(async () => {
        const { data } = await supabase
          .from('profiles')
          .select('telegram_linked')
          .eq('id', user.id)
          .single();

        if (data?.telegram_linked) {
          setIsPolling(false);
          setTgCode(null);
          await refreshProfile();
          setSuccessMsg('Telegram account linked successfully! ✓');
        }
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPolling, user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phoneNumber) {
      setErrorMsg('Full Name and Phone Number are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone_number: phoneNumber,
          avatar_url: avatarUrl || null
        })
        .eq('id', user?.id || '');

      if (error) {
        throw error;
      }

      await refreshProfile();
      setSuccessMsg('Profile details updated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8 || !/\d/.test(newPassword) || !/[!@#$%^&*()_+\-=\[\]{};':",\\|.<>\/?]/.test(newPassword)) {
      setErrorMsg('Password must be 8+ characters and contain a number and special character.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw error;
      }
      setSuccessMsg('Password changed successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkTelegram = async () => {
    setLoadingCode(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await apiPost<{ code: string; expiresAt: string }>('/telegram/link');
      setTgCode(data.code);
      setTgExpiry(new Date(data.expiresAt).toLocaleTimeString());
      setIsPolling(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate linking code.');
    } finally {
      setLoadingCode(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          telegram_chat_id: null,
          telegram_linked: false,
          telegram_link_code: null,
          telegram_link_code_expires_at: null
        })
        .eq('id', user?.id || '');

      if (error) throw error;

      await refreshProfile();
      setSuccessMsg('Telegram account unlinked successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to unlink Telegram.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
        <h1 className="text-3xl font-bold font-display text-primary-text mb-1">
          Portal Settings
        </h1>
        <p className="text-sm text-gray-500 font-sans">
          Manage your personal details, passwords, and bot notifications preference.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Tabs List */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm h-fit space-y-1">
          <button
            onClick={() => { setActiveTab('profile'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'profile' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-primary-text'
            }`}
          >
            <User className="h-4 w-4" />
            <span>Profile Details</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('password'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'password' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-primary-text'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>Change Password</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('notifications'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'notifications' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-primary-text'
            }`}
          >
            <Send className="h-4 w-4" />
            <span>Notifications</span>
          </button>
        </div>

        {/* Content Box */}
        <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl">
          {successMsg && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center space-x-3 text-green-700 mb-6 animate-fade-in">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center space-x-3 text-red-700 mb-6 animate-fade-in">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: PROFILE DETAILS */}
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <h3 className="text-xl font-bold font-display text-primary-text mb-4 border-b border-gray-50 pb-2">Profile Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">Avatar Image URL</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm"
                  placeholder="https://example.com/photo.jpg"
                />
              </div>

              <div className="border-t border-gray-50 pt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center bg-primary text-white font-semibold py-3 px-6 rounded-2xl hover:bg-indigo-800 disabled:opacity-50 transition-all cursor-pointer text-sm"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Profile Details
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CHANGE PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <h3 className="text-xl font-bold font-display text-primary-text mb-4 border-b border-gray-50 pb-2">Change Password</h3>

              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-primary-text focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm"
                  />
                </div>
              </div>

              <div className="border-t border-gray-50 pt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !newPassword}
                  className="flex items-center bg-primary text-white font-semibold py-3 px-6 rounded-2xl hover:bg-indigo-800 disabled:opacity-50 transition-all cursor-pointer text-sm"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Update Password
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: NOTIFICATIONS LINK TELEGRAM */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold font-display text-primary-text mb-4 border-b border-gray-50 pb-2">Notification Preferences</h3>

              {/* Email notifications preferences toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-50 p-2 rounded-xl text-primary border border-indigo-100">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-primary-text">Email Reminders</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Receive report deadline reminder emails.</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setEmailNotif(!emailNotif)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    emailNotif ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      emailNotif ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Telegram bot configurations */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-indigo-50 p-2 rounded-xl text-primary border border-indigo-100">
                      <Send className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-primary-text">Telegram Bot Sync</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Receive reminders directly to your Telegram chat.</p>
                    </div>
                  </div>
                  
                  {user?.telegram_linked ? (
                    <span className="text-xs font-bold text-green-custom bg-green-50 border border-green-200 px-3 py-1 rounded-full flex items-center">
                      Telegram linked ✓
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center">
                      Not Linked
                    </span>
                  )}
                </div>

                {user?.telegram_linked ? (
                  <div className="pt-2 border-t border-gray-100/50">
                    <button
                      onClick={handleUnlinkTelegram}
                      disabled={isSubmitting}
                      className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 px-4 py-2 rounded-xl transition-all cursor-pointer"
                    >
                      {isSubmitting && <Loader2 className="h-3 w-3 animate-spin mr-1 inline" />}
                      Unlink Telegram Account
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2 border-t border-gray-100/50">
                    {!tgCode ? (
                      <button
                        onClick={handleLinkTelegram}
                        disabled={loadingCode}
                        className="text-xs font-semibold text-primary bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center"
                      >
                        {loadingCode && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                        Generate Telegram Linking Code
                      </button>
                    ) : (
                      <div className="bg-white border border-indigo-50 p-4 rounded-xl text-center space-y-3 animate-fade-in">
                        <span className="text-xxs font-bold text-indigo-400 uppercase tracking-widest block">Verifying Code</span>
                        <div className="text-3xl font-mono font-bold text-primary-text bg-indigo-50/50 px-5 py-2 rounded-lg border border-indigo-50 inline-block tracking-widest">
                          {tgCode}
                        </div>
                        <p className="text-xxs text-gray-400">
                          Expires at <strong>{tgExpiry}</strong>. Polling active...
                        </p>
                        <div className="text-left text-xs text-primary-text space-y-1.5 pt-2 border-t border-gray-100">
                          <p>1. Open Telegram and message <strong>@{botUsername}</strong>.</p>
                          <p>2. Send <code>/start</code>, then send the 6-digit code above.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
export default Settings;
