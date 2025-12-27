import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bike, User, Shield } from "lucide-react";

type UserType = "rider" | "captain" | "admin";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState<UserType>("rider");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Route based on user type (would check roles in real app)
        navigate(userType === "admin" ? "/admin" : userType === "captain" ? "/captain" : "/rider");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name, phone, user_type: userType },
          },
        });
        if (error) throw error;

        // Create profile and role for user
        if (data.user) {
          // Create profile first
          const { error: profileError } = await supabase.from("profiles").insert({
            user_id: data.user.id,
            name,
            phone,
            email,
          });
          if (profileError) {
            console.error("Profile creation error:", profileError);
            toast({
              variant: "destructive",
              title: "Profile creation failed",
              description: profileError.message,
            });
          }

          // Create role
          const { error: roleError } = await supabase.from("user_roles").insert({
            user_id: data.user.id,
            role: userType,
          });
          if (roleError) {
            console.error("Role creation error:", roleError);
            toast({
              variant: "destructive",
              title: "Role creation failed",
              description: roleError.message,
            });
          }

          // Create captain record if signing up as captain
          if (userType === "captain") {
            const { error: captainError } = await supabase.from("captains").insert({
              user_id: data.user.id,
              status: 'offline',
              kyc_status: 'pending',
              is_verified: false,
            });
            if (captainError) {
              console.error("Captain creation error:", captainError);
              toast({
                variant: "destructive",
                title: "Captain account creation failed",
                description: captainError.message,
              });
            }
          }
        }

        toast({
          title: "Account created!",
          description: "You can now log in to your account.",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const userTypes = [
    { id: "rider" as const, label: "Rider", icon: User },
    { id: "captain" as const, label: "Captain", icon: Bike },
    { id: "admin" as const, label: "Admin", icon: Shield },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold">
            <span className="text-primary">Quick</span> <span className="text-secondary">Ride</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? "Welcome back!" : "Create your account"}
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-lg border border-border/50">
          {/* User Type Selection */}
          <div className="flex gap-2 mb-6">
            {userTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setUserType(type.id)}
                className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl transition-all border-2 ${userType === type.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-card-foreground border-border hover:border-primary/50"
                  }`}
              >
                <type.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            ))}
          </div>

          <Tabs value={isLogin ? "login" : "signup"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" onClick={() => setIsLogin(true)}>
                Login
              </TabsTrigger>
              <TabsTrigger value="signup" onClick={() => setIsLogin(false)}>
                Sign Up
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      required={!isLogin}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      required={!isLogin}
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait..." : isLogin ? "Login" : "Create Account"}
              </Button>
            </form>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;