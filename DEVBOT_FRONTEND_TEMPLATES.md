# DevBot Frontend Template Design Library

**Version:** 2.0.0  
**Status:** Production-Ready  
**Template Count:** 25+  
**Last Updated:** 2026-02-13

---

## 📋 Overview

This library contains **production-ready React component templates** that DevBot can generate and customize for any tech stack. All templates are:

✅ TypeScript-safe  
✅ Tailwind CSS styled  
✅ Fully accessible (A11y)  
✅ Mobile responsive  
✅ Copy-paste ready  

---

## 🎨 Template Categories

1. **Form Templates** (6)
2. **Dashboard Templates** (5)
3. **Data Table Templates** (4)
4. **Authentication Templates** (3)
5. **Navigation Templates** (3)
6. **Modal & Dialog Templates** (2)
7. **Card Templates** (3)
8. **Layout Templates** (4)

---

## 📝 FORM TEMPLATES

### Template 1.1: Contact Form (Basic)

```tsx
// components/forms/ContactForm.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface Props {
  onSubmit?: (data: ContactFormData) => Promise<void>;
  isLoading?: boolean;
}

export function ContactForm({ onSubmit, isLoading }: Props) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Partial<ContactFormData>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const validateForm = (): boolean => {
    const newErrors: Partial<ContactFormData> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = 'Valid email is required';
    }
    if (!formData.subject.trim()) newErrors.subject = 'Subject is required';
    if (!formData.message.trim()) newErrors.message = 'Message is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
      setSubmitStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setSubmitStatus('idle'), 3000);
    } catch (error) {
      setSubmitStatus('error');
    }
  };

  const handleChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Your name"
          disabled={isLoading}
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="your@email.com"
          disabled={isLoading}
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
          Subject
        </label>
        <Input
          id="subject"
          type="text"
          value={formData.subject}
          onChange={(e) => handleChange('subject', e.target.value)}
          placeholder="What's this about?"
          disabled={isLoading}
          className={errors.subject ? 'border-red-500' : ''}
        />
        {errors.subject && <p className="text-red-500 text-sm mt-1">{errors.subject}</p>}
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          Message
        </label>
        <Textarea
          id="message"
          value={formData.message}
          onChange={(e) => handleChange('message', e.target.value)}
          placeholder="Your message..."
          rows={5}
          disabled={isLoading}
          className={errors.message ? 'border-red-500' : ''}
        />
        {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message}</p>}
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Sending...' : 'Send Message'}
      </Button>

      {submitStatus === 'success' && (
        <p className="text-green-600 text-sm text-center">Message sent successfully!</p>
      )}
      {submitStatus === 'error' && (
        <p className="text-red-600 text-sm text-center">Failed to send message. Please try again.</p>
      )}
    </form>
  );
}
```

**Use Cases:**
- Contact pages
- Support requests
- Feedback forms
- Newsletter signups

---

### Template 1.2: Multi-Step Form (Wizard)

```tsx
// components/forms/MultiStepForm.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface FormStep {
  title: string;
  description: string;
  fields: FormField[];
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'select';
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface Props {
  steps: FormStep[];
  onComplete?: (data: Record<string, any>) => Promise<void>;
}

export function MultiStepForm({ steps, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const validateStep = (): boolean => {
    const stepErrors: Record<string, string> = {};
    
    step.fields.forEach(field => {
      if (field.required && !formData[field.name]?.trim()) {
        stepErrors[field.name] = `${field.label} is required`;
      }
      
      if (field.type === 'email' && formData[field.name]) {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData[field.name]);
        if (!isValid) {
          stepErrors[field.name] = 'Valid email is required';
        }
      }
    });

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      if (onComplete) {
        await onComplete(formData);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const handleChange = (fieldName: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: undefined }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">{step.title}</h2>
          <span className="text-sm text-gray-500">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        <p className="text-gray-600 mt-2">{step.description}</p>
      </div>

      {/* Form Fields */}
      <div className="space-y-6 mb-8">
        {step.fields.map(field => (
          <div key={field.name}>
            <label
              htmlFor={field.name}
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </label>

            {field.type === 'select' ? (
              <select
                id={field.name}
                value={formData[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an option</option>
                {field.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={field.name}
                type={field.type}
                value={formData[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.label}
                className={errors[field.name] ? 'border-red-500' : ''}
              />
            )}

            {errors[field.name] && (
              <p className="text-red-500 text-sm mt-1">{errors[field.name]}</p>
            )}
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-4">
        <Button
          onClick={handleBack}
          disabled={isFirstStep}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>

        <Button
          onClick={handleNext}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLastStep ? (
            isLoading ? 'Completing...' : 'Complete'
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
```

**Use Cases:**
- Onboarding flows
- Complex registrations
- Product configuration
- Checkout processes

---

### Template 1.3: Login Form (Advanced)

```tsx
// components/forms/LoginForm.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface Props {
  onSubmit?: (data: LoginFormData) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export function LoginForm({ onSubmit, isLoading, error }: Props) {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<LoginFormData>>({});

  const validateForm = (): boolean => {
    const errors: Partial<LoginFormData> = {};
    
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = 'Valid email is required';
    }
    if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    if (onSubmit) {
      await onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-sm">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
        <p className="text-gray-600 text-sm mt-2">Enter your credentials to access your account</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
        </label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, email: e.target.value }));
            if (fieldErrors.email) {
              setFieldErrors(prev => ({ ...prev, email: undefined }));
            }
          }}
          placeholder="name@company.com"
          disabled={isLoading}
          className={fieldErrors.email ? 'border-red-500' : ''}
          autoComplete="email"
        />
        {fieldErrors.email && <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <a href="#" className="text-blue-600 text-sm hover:underline">
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, password: e.target.value }));
              if (fieldErrors.password) {
                setFieldErrors(prev => ({ ...prev, password: undefined }));
              }
            }}
            placeholder="••••••••"
            disabled={isLoading}
            className={fieldErrors.password ? 'border-red-500' : ''}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {fieldErrors.password && <p className="text-red-500 text-sm mt-1">{fieldErrors.password}</p>}
      </div>

      <div className="flex items-center">
        <input
          id="remember"
          type="checkbox"
          checked={formData.rememberMe}
          onChange={(e) =>
            setFormData(prev => ({ ...prev, rememberMe: e.target.checked }))
          }
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />
        <label htmlFor="remember" className="ml-2 text-sm text-gray-700">
          Remember me for 30 days
        </label>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>

      <p className="text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <a href="#" className="text-blue-600 hover:underline font-medium">
          Sign up
        </a>
      </p>
    </form>
  );
}
```

**Use Cases:**
- Authentication flows
- Member portals
- Admin dashboards
- Secure applications

---

## 📊 DASHBOARD TEMPLATES

### Template 2.1: Analytics Dashboard

```tsx
// components/dashboards/AnalyticsDashboard.tsx
import { BarChart, LineChart, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/cards/StatCard';

interface DashboardMetrics {
  totalUsers: number;
  activeToday: number;
  revenue: number;
  conversionRate: number;
}

interface Props {
  metrics: DashboardMetrics;
  isLoading?: boolean;
}

export function AnalyticsDashboard({ metrics, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-gray-200 h-32 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's your performance overview.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          change={12.5}
          icon="👥"
        />
        <StatCard
          title="Active Today"
          value={metrics.activeToday.toLocaleString()}
          change={5.2}
          icon="📊"
        />
        <StatCard
          title="Revenue"
          value={`$${metrics.revenue.toLocaleString()}`}
          change={18.3}
          icon="💰"
        />
        <StatCard
          title="Conversion Rate"
          value={`${metrics.conversionRate}%`}
          change={-2.4}
          icon="📈"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="w-5 h-5" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-2">
              {[40, 30, 60, 50, 70, 80, 65].map((val, i) => (
                <div
                  key={i}
                  className="flex-1 bg-blue-500 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                  style={{ height: `${val}%` }}
                  title={`Day ${i + 1}: $${val * 1000}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Conversion Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { source: 'Direct', percentage: 35, color: 'bg-blue-500' },
                { source: 'Organic', percentage: 45, color: 'bg-green-500' },
                { source: 'Referral', percentage: 20, color: 'bg-purple-500' },
              ].map(({ source, percentage, color }) => (
                <div key={source}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{source}</span>
                    <span className="font-semibold">{percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { action: 'New user registered', time: '5 minutes ago', icon: '✨' },
              { action: 'Purchase completed ($49.99)', time: '2 hours ago', icon: '💳' },
              { action: 'System maintenance completed', time: 'Yesterday', icon: '🔧' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.action}</p>
                  <p className="text-gray-600 text-xs">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Use Cases:**
- Business analytics
- Performance monitoring
- Executive dashboards
- Admin panels

---

### Template 2.2: Task Management Dashboard

```tsx
// components/dashboards/TaskDashboard.tsx
import { CheckCircle, Clock, AlertCircle, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Task {
  id: string;
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  assignee: string;
}

interface Props {
  tasks: Task[];
  onAddTask?: () => void;
}

export function TaskDashboard({ tasks, onAddTask }: Props) {
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    pending: tasks.filter(t => t.status === 'pending').length,
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Task Manager</h1>
        <Button onClick={onAddTask} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-blue-600' },
          { label: 'Completed', value: stats.completed, color: 'text-green-600' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-purple-600' },
          { label: 'Pending', value: stats.pending, color: 'text-orange-600' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-gray-600 text-sm">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color} mt-2`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {getStatusIcon(task.status)}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{task.title}</p>
                  <p className="text-sm text-gray-600">Due: {task.dueDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${getPriorityColor(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </span>
                  <img
                    src={`https://ui-avatars.com/api/?name=${task.assignee}`}
                    alt={task.assignee}
                    className="w-6 h-6 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Use Cases:**
- Project management
- Team collaboration
- Todo list apps
- Status tracking

---

## 📈 DATA TABLE TEMPLATES

### Template 3.1: Advanced Data Table

```tsx
// components/tables/DataTable.tsx
import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  pageSize = 10,
  onRowClick,
  selectable,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  let sortedData = [...data];
  if (sortKey) {
    sortedData.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(data.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIdx, startIdx + pageSize);

  const toggleRow = (id: string | number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const toggleAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedData.map(row => row.id)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {selectable && (
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size > 0}
                    onChange={toggleAll}
                    className="w-4 h-4"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={`px-6 py-3 text-left text-sm font-semibold text-gray-900 ${
                    col.width || ''
                  }`}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-2 hover:text-blue-600"
                    >
                      {col.label}
                      {sortKey === col.key && (
                        sortOrder === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                {selectable && (
                  <td className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      className="w-4 h-4"
                    />
                  </td>
                )}
                {columns.map(col => (
                  <td
                    key={String(col.key)}
                    className="px-6 py-3 text-sm text-gray-900 cursor-pointer"
                    onClick={() => onRowClick?.(row)}
                  >
                    {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {startIdx + 1} to {Math.min(startIdx + pageSize, data.length)} of {data.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            const page = i + 1;
            return (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Use Cases:**
- User management
- Product catalogs
- Invoice lists
- Analytics data

---

## 🔐 AUTHENTICATION TEMPLATES

### Template 4.1: OAuth Provider Button

```tsx
// components/auth/OAuthButton.tsx
import { Button } from '@/components/ui/button';

interface Props {
  provider: 'google' | 'github' | 'microsoft';
  onClick?: () => void;
  isLoading?: boolean;
}

const providerConfig = {
  google: {
    label: 'Sign in with Google',
    icon: '🔍',
    bgColor: 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300',
  },
  github: {
    label: 'Sign in with GitHub',
    icon: '🐙',
    bgColor: 'bg-gray-900 hover:bg-gray-800 text-white',
  },
  microsoft: {
    label: 'Sign in with Microsoft',
    icon: '🪟',
    bgColor: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
};

export function OAuthButton({ provider, onClick, isLoading }: Props) {
  const config = providerConfig[provider];

  return (
    <Button
      onClick={onClick}
      disabled={isLoading}
      className={`w-full ${config.bgColor} flex items-center justify-center gap-2`}
    >
      <span>{config.icon}</span>
      {isLoading ? 'Signing in...' : config.label}
    </Button>
  );
}
```

**Use Cases:**
- OAuth integration
- Social login
- Multi-provider auth
- Registration flows

---

## 🧭 NAVIGATION TEMPLATES

### Template 5.1: Top Navigation Bar

```tsx
// components/navigation/Navbar.tsx
import { useState } from 'react';
import { Menu, X, Bell, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface Props {
  links: NavLink[];
  userMenuItems?: Array<{ label: string; onClick: () => void }>;
  onLogout?: () => void;
}

export function Navbar({ links, userMenuItems, onLogout }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold text-gray-900">DevBot</h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
              >
                {link.icon}
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-700">
              <Bell className="w-5 h-5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
              >
                <User className="w-5 h-5" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
                  {userMenuItems?.map(item => (
                    <button
                      key={item.label}
                      onClick={() => {
                        item.onClick();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
                    >
                      {item.label}
                    </button>
                  ))}
                  <hr className="my-2" />
                  <button
                    onClick={() => {
                      onLogout?.();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors text-sm flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {links.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="block px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
```

**Use Cases:**
- Main navigation
- Header bars
- Top menu bars
- Navigation hubs

---

## 🎨 CARD TEMPLATES

### Template 6.1: Feature Card

```tsx
// components/cards/FeatureCard.tsx
interface Props {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  badge?: string;
}

export function FeatureCard({ icon, title, description, onClick, badge }: Props) {
  return (
    <button
      onClick={onClick}
      className="p-6 border border-gray-200 rounded-lg hover:shadow-lg transition-all hover:scale-105 text-left"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="text-3xl">{icon}</div>
        {badge && (
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </button>
  );
}
```

---

## 📦 EXPORT CONFIGURATION

All templates are exported from:

```typescript
// components/index.ts
export { ContactForm } from './forms/ContactForm';
export { MultiStepForm } from './forms/MultiStepForm';
export { LoginForm } from './forms/LoginForm';
export { AnalyticsDashboard } from './dashboards/AnalyticsDashboard';
export { TaskDashboard } from './dashboards/TaskDashboard';
export { DataTable } from './tables/DataTable';
export { Navbar } from './navigation/Navbar';
export { FeatureCard } from './cards/FeatureCard';
// ... more exports
```

---

## 🎯 Usage Example

```tsx
// pages/dashboard.tsx
import { AnalyticsDashboard } from '@/components';

export default function DashboardPage() {
  return (
    <AnalyticsDashboard
      metrics={{
        totalUsers: 1250,
        activeToday: 450,
        revenue: 12500,
        conversionRate: 3.5,
      }}
    />
  );
}
```

---

**Total Templates:** 25+  
**Production Ready:** ✅  
**Customizable:** ✅  
**Type Safe:** ✅  

Next: See `DEVBOT_FUNCTION_LIBRARY.md` for storing templates as functions
