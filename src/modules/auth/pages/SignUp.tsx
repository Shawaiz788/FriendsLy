import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import logoImg from "@/assets/logo.png";

const SignUp = () => {
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [usernameMsg, setUsernameMsg] = useState('');

    // Check username availability as user types
    async function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
      const value = e.target.value;
      setForm({ ...form, username: value });
      if (!value) {
        setUsernameStatus('idle');
        setUsernameMsg('');
        return;
      }
      setUsernameStatus('checking');
      setUsernameMsg('Checking...');
      try {
        const result = await (await import("@/lib/api")).checkUsernameAvailability(value);
        if (result.available) {
          setUsernameStatus('available');
          setUsernameMsg('Username available');
        } else {
          setUsernameStatus('taken');
          setUsernameMsg('Username not available');
        }
      } catch {
        setUsernameStatus('idle');
        setUsernameMsg('');
      }
    }
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    date_of_birth: "",
    gender: "",
    consent: false,
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (step === 1) {
      setStep(2);
    } else {
      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (!form.consent) {
        setError("You must agree to the terms");
        return;
      }
      try {
        const { error: apiError, user } = await (await import("@/lib/api")).registerUser({
          name: form.name,
          username: form.username,
          email: form.email,
          phone: form.phone,
          password: form.password,
          date_of_birth: form.date_of_birth,
          gender: form.gender,
        });
        if (apiError) {
          setError(apiError);
        } else {
          setSuccess(true);
          navigate("/login");
        }
      } catch (err) {
        setError("Registration failed. Please try again.");
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background px-6 pt-4 pb-10">
      <button onClick={() => step === 1 ? navigate("/") : setStep(1)} className="self-start text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2">
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="flex-1 flex flex-col items-center pt-6">
        <img src={logoImg} alt="FriendsLy" className="w-14 h-14 mb-5" />
        <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
          {step === 1 ? "Create account" : "Almost there"}
        </h1>
        <p className="text-muted-foreground mb-6 text-center">
          {step === 1 ? "Join FriendsLy and connect with friends" : "Set your password to get started"}
        </p>

        {/* Step indicators */}
        <div className="flex gap-2 mb-8">
          <div className={`h-1.5 w-8 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1.5 w-8 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 animate-float-in">
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Your name" className="h-12 rounded-xl bg-card border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Username</label>
                <Input value={form.username} onChange={handleUsernameChange} placeholder="Choose a username" className="h-12 rounded-xl bg-card border-border" />
                {form.username && (
                  <span className={`text-sm mt-1 ${usernameStatus === 'available' ? 'text-green-600' : usernameStatus === 'taken' ? 'text-red-500' : 'text-muted-foreground'}`}>{usernameMsg}</span>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="you@example.com" className="h-12 rounded-xl bg-card border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Phone</label>
                <Input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="+1 234 567 890" className="h-12 rounded-xl bg-card border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Date of Birth</label>
                <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({...form, date_of_birth: e.target.value})} className="h-12 rounded-xl bg-card border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Gender</label>
                <select value={form.gender} onChange={(e) => setForm({...form, gender: e.target.value})} className="h-12 rounded-xl bg-card border-border w-full">
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} placeholder="Min. 8 characters" className="h-12 rounded-xl bg-card border-border pr-12" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Confirm Password</label>
                <Input type="password" value={form.confirmPassword} onChange={(e) => setForm({...form, confirmPassword: e.target.value})} placeholder="Re-enter password" className="h-12 rounded-xl bg-card border-border" />
              </div>
              <label className="flex items-start gap-3 text-sm text-muted-foreground pt-2">
                <input type="checkbox" checked={form.consent} onChange={(e) => setForm({...form, consent: e.target.checked})} className="mt-0.5 rounded border-border" />
                <span>I agree to the Terms of Service, Privacy Policy, and Location Awareness Agreement</span>
              </label>
            </>
          )}

          <Button variant="hero" size="xl" type="submit" className="w-full mt-4">
            {step === 1 ? "Continue" : "Create Account"}
          </Button>
          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          {success && <div className="text-green-600 text-sm mt-2">Account created! Redirecting...</div>}
        </form>

        <p className="text-sm text-muted-foreground mt-8">
          Already have an account?{" "}
          <button onClick={() => navigate("/login")} className="text-primary font-semibold hover:underline">
            Log In
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignUp;
