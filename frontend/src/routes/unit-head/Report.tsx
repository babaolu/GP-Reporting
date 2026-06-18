import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/api';
import { getCurrentReportingMonth, formatMonthLabel } from '../../lib/date-helpers';
import useDeadline from '../../hooks/useDeadline';
import MDEditor from '@uiw/react-md-editor';
import { FileUp, FileText, Send, CheckCircle2, AlertTriangle, File, X, Info, Loader2 } from 'lucide-react';

export const Report: React.FC = () => {
  const { user } = useAuth();
  const currentMonthStr = getCurrentReportingMonth();
  const { daysRemaining, deadline, isLoading: deadlineLoading } = useDeadline(currentMonthStr);

  const [activeTab, setActiveTab] = useState<'upload' | 'write'>('write');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Markdown Editor states
  const [unitName, setUnitName] = useState('My Unit');
  const [markdownContent, setMarkdownContent] = useState('');

  // Determine if report already exists to decide if this is an update
  const [existingReport, setExistingReport] = useState<any | null>(null);


  // Generate Report Template
  const generateTemplate = (uName: string) => {
    const dateLabel = formatMonthLabel(currentMonthStr);
    return `## ${uName} Monthly Report — ${dateLabel}

### 1. Progress This Month
_Describe the activities carried out, projects advanced, and goals worked on._

### 2. Key Achievements & Breakthroughs
_Highlight any significant wins, milestones reached, or positive outcomes._

### 3. Challenges & Issues Faced
_Describe any difficulties encountered. Be specific so they can be addressed._

### 4. Critical or Urgent Matters
_Flag any issues requiring immediate attention from leadership._

### 5. Plans for Next Month
_Outline what the unit intends to focus on in the coming month._`;
  };

  const loadUnitNameAndReport = async () => {
    if (!user?.unit_id) return;
    try {
      // 1. Fetch unit name
      const { data: unitData } = await supabase
        .from('units')
        .select('name')
        .eq('id', user.unit_id)
        .single();
      
      if (unitData) {
        setUnitName(unitData.name);
      }

      // 2. Fetch existing report
      const { data: reportData } = await supabase
        .from('reports')
        .select('*')
        .eq('unit_id', user.unit_id)
        .eq('month', currentMonthStr)
        .eq('is_latest', true)
        .maybeSingle();

      if (reportData) {
        setExistingReport(reportData);
        if (reportData.content_text) {
          setMarkdownContent(reportData.content_text);
          setActiveTab('write');
        } else {
          setActiveTab('upload');
        }
      } else {
        setMarkdownContent(generateTemplate(unitData?.name || 'My Unit'));
      }
    } catch (err) {
      console.error('Failed to load unit/report data:', err);
    } finally {
      // Done loading
    }
  };

  useEffect(() => {
    loadUnitNameAndReport();
  }, [user, currentMonthStr]);

  // Handle Tab Switch (Mutual Exclusivity Enforced)
  const handleTabChange = (tab: 'upload' | 'write') => {
    if (tab === 'write') {
      setSelectedFile(null); // Clear file input
    } else {
      setMarkdownContent(generateTemplate(unitName)); // Clear custom write changes/reset to template
    }
    setActiveTab(tab);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Drag and Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'md'].includes(ext || '')) {
      setErrorMsg('Invalid file format. Only PDF, DOCX, and MD files are accepted.');
      setSelectedFile(null);
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10 MB limit
      setErrorMsg('File is too large. Maximum size allowed is 10 MB.');
      setSelectedFile(null);
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {

      let payload: any = {
        month: currentMonthStr
      };

      if (activeTab === 'write') {
        if (!markdownContent || markdownContent.trim() === '') {
          throw new Error('Please fill in the report details before submitting.');
        }
        payload.contentText = markdownContent;
        payload.parsedText = markdownContent;
      } else {
        // Tab is Upload
        if (!selectedFile) {
          throw new Error('Please select a file to upload.');
        }

        const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'text';
        const fileTypeMap: Record<string, string> = { pdf: 'pdf', docx: 'docx', md: 'md' };
        const fileType = fileTypeMap[ext] || 'text';

        // 1. Upload file to Supabase Storage
        const storagePath = `reports_${user?.unit_id}_${currentMonthStr}_${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('reports')
          .upload(storagePath, selectedFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError || !uploadData) {
          console.error('Storage upload failed:', uploadError);
          throw new Error('Failed to upload report file to storage bucket.');
        }

        const reportFileUrl = uploadData.path;

        // 2. Request backend to extract text
        const parseResult = await apiPost<{ parsedText: string }>('/parse', {
          fileUrl: reportFileUrl,
          fileType
        });

        payload.fileUrl = reportFileUrl;
        payload.fileType = fileType;
        payload.parsedText = parseResult.parsedText;
      }

      // 3. Submit report to backend (decides silent overwrite vs revision versioning based on deadline lock)
      const submitEndpoint = existingReport ? '/reports/resubmit' : '/reports/submit';
      const result = await apiPost<any>(submitEndpoint, payload);

      setSuccessMsg(result.message || 'Report submitted successfully.');
      
      // Reload updated report details
      await loadUnitNameAndReport();
      removeFile();

    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMsg(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLate = daysRemaining === 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold font-display text-primary-text mb-1">
            Submit {unitName} Monthly Report
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Reporting month: <span className="font-semibold text-primary">{formatMonthLabel(currentMonthStr)}</span>
          </p>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3 text-sm text-indigo-900 shrink-0">
          <span className="font-bold">Deadline Date: </span>
          {deadlineLoading ? 'Loading...' : deadline?.deadline_date ? new Date(deadline.deadline_date).toLocaleDateString() : 'N/A'}
        </div>
      </div>

      {/* Late Submission Warnings */}
      {isLate && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start space-x-3 shadow-sm">
          <AlertTriangle className="h-6 w-6 text-warning-custom shrink-0 mt-0.5" />
          <div>
            <h4 className="text-base font-bold text-amber-900 font-display">Late Submission Period</h4>
            <p className="text-sm text-amber-700 mt-1">
              {existingReport 
                ? 'The deadline has passed. Submitting this revision will archive your original on-time submission and create a new version flagged as "Late".'
                : 'The submission deadline has passed. This report will be flagged as "Late Submission" on the administrator dashboard.'}
            </p>
          </div>
        </div>
      )}

      {/* Form Submission */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        {/* Form Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            type="button"
            onClick={() => handleTabChange('write')}
            className={`flex-1 flex items-center justify-center py-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'write' 
                ? 'border-primary text-primary bg-indigo-50/10' 
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'
            }`}
          >
            <FileText className="h-4 w-4 mr-2" /> Write Report
          </button>
          
          <button
            type="button"
            onClick={() => handleTabChange('upload')}
            className={`flex-1 flex items-center justify-center py-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload' 
                ? 'border-primary text-primary bg-indigo-50/10' 
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'
            }`}
          >
            <FileUp className="h-4 w-4 mr-2" /> Upload File
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          
          {successMsg && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center space-x-3 text-green-700">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center space-x-3 text-red-700">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: WRITE REPORT */}
          {activeTab === 'write' && (
            <div className="space-y-4" data-color-mode="light">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-bold text-primary-text">Report Text (Markdown Editor)</label>
                <span className="text-xs text-gray-400">Autosaves content to session drafts</span>
              </div>
              
              <MDEditor
                value={markdownContent}
                onChange={(val) => setMarkdownContent(val || '')}
                height={400}
                preview="edit"
              />
              
              <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded-lg flex items-center space-x-2 border border-gray-100">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <span>This template is a guide. You may edit or restructure it freely. A structured report helps generate better AI summaries.</span>
              </p>
            </div>
          )}

          {/* TAB 2: UPLOAD FILE */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <label className="block text-sm font-bold text-primary-text">Upload Report File</label>
              
              {!selectedFile ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 cursor-pointer transition-all duration-200 ${
                    dragActive 
                      ? 'border-primary bg-indigo-50/20 scale-98' 
                      : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.md"
                  />
                  <div className="bg-indigo-50 text-primary p-4 rounded-full border border-indigo-100">
                    <FileUp className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary-text font-display">Drag & Drop file here</p>
                    <p className="text-xs text-gray-500 mt-1">Accepts PDF, Word (.docx) and Markdown (.md) documents up to 10 MB</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-xl hover:bg-indigo-100/50 transition-colors"
                  >
                    Select File From Computer
                  </button>
                </div>
              ) : (
                <div className="border border-indigo-100 bg-indigo-50/20 rounded-2xl p-6 flex items-center justify-between animate-fade-in">
                  <div className="flex items-center space-x-4">
                    <div className="bg-primary text-white p-3 rounded-xl">
                      <File className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-primary-text truncate max-w-md">{selectedFile.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="text-gray-400 hover:text-red-500 p-2 hover:bg-white rounded-full border border-transparent hover:border-gray-100 transition-all cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Trigger */}
          <div className="border-t border-gray-100 pt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center bg-primary text-white font-semibold py-3 px-6 rounded-2xl hover:bg-indigo-800 disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-indigo-100 hover:shadow-indigo-200 text-sm"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {isLate 
                ? (existingReport ? 'Submit Late Revision' : 'Submit Late Report') 
                : (existingReport ? 'Update Report Submissions' : 'Submit Report')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
export default Report;
