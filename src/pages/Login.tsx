import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import logoImg from "@/assets/logo.png";

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login - navigate to home
    navigate("/home");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background px-6 pt-4 pb-10">
      <button onClick={() => navigate("/")} className="self-start text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2">
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="flex-1 flex flex-col items-center pt-8">
        <img src={logoImg} alt="FriendsLy" className="w-16 h-16 mb-6 animate-float-in" />
        <h1 className="font-serif text-3xl font-bold text-foreground mb-2 animate-float-in" style={{ animationDelay: "0.1s", opacity: 0 }}>
          Welcome back
        </h1>
        <p className="text-muted-foreground mb-8 animate-float-in" style={{ animationDelay: "0.15s", opacity: 0 }}>
          Sign in to your account
        </p>

        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 animate-float-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email or Phone</label>
            <Input
              type="text"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl bg-card border-border"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-card border-border pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              <input type="checkbox" className="rounded border-border" />
              Remember me
            </label>
            <button type="button" className="text-primary hover:underline font-medium">
              Forgot password?
            </button>
          </div>

          <Button variant="hero" size="xl" type="submit" className="w-full mt-6">
            Log In
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-8">
          Don't have an account?{" "}
          <button onClick={() => navigate("/signup")} className="text-primary font-semibold hover:underline">
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
