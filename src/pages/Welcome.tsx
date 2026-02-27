import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo.png";
import heroImg from "@/assets/welcome-hero.png";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8">
        <div className="animate-float-in" style={{ animationDelay: "0.1s" }}>
          <img src={logoImg} alt="FriendsLy logo" className="w-24 h-24 mx-auto mb-4" />
        </div>

        <h1 className="font-serif text-4xl font-bold text-foreground text-center animate-float-in" style={{ animationDelay: "0.2s", opacity: 0 }}>
          FriendsLy
        </h1>

        <p className="text-muted-foreground text-center mt-3 text-lg max-w-xs animate-float-in" style={{ animationDelay: "0.3s", opacity: 0 }}>
          Connect intentionally.<br />Meet meaningfully.
        </p>

        <div className="mt-8 w-full max-w-xs animate-float-in" style={{ animationDelay: "0.4s", opacity: 0 }}>
          <img
            src={heroImg}
            alt="Friends meeting"
            className="w-full rounded-3xl shadow-xl"
          />
        </div>
      </div>

      <div className="px-6 pb-10 space-y-3 max-w-xs mx-auto w-full">
        <Button
          variant="hero"
          size="xl"
          className="w-full animate-float-in"
          style={{ animationDelay: "0.5s", opacity: 0 }}
          onClick={() => navigate("/signup")}
        >
          Sign Up
        </Button>
        <Button
          variant="hero-outline"
          size="xl"
          className="w-full animate-float-in"
          style={{ animationDelay: "0.6s", opacity: 0 }}
          onClick={() => navigate("/login")}
        >
          Log In
        </Button>
      </div>
    </div>
  );
};

export default Welcome;
