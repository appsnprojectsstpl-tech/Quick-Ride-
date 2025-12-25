import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bike, User } from "lucide-react";
import { z } from "zod";

// Input validation schemas
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().min(10, "Please enter a valid phone number").max(15),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Only allow rider and captain signup - admin must be assigned by existing admin
type UserType = "rider" | "captain";

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
        // Validate login inputs
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          throw new Error(validation.error.errors[0].message);
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Check user role and route accordingly
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();
          
          const role = roleData?.role || 'rider';
          navigate(role === "admin" ? "/admin" : role === "captain" ? "/captain" : "/rider");
        }
      } else {
        // Validate signup inputs
        const validation = signupSchema.safeParse({ name, phone, email, password });
        if (!validation.success) {
          throw new Error(validation.error.errors[0].message);
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name, phone, user_type: userType },
          },
        });
        if (error) throw error;

        // SECURITY: Role is now auto-assigned by database trigger
        // Default role is 'rider' - captains need admin approval after KYC
        
        // Create captain record if signing up as captain (pending verification)
        if (data.user && userType === "captain") {
          const { error: captainError } = await supabase.from("captains").insert({
            user_id: data.user.id,
            // Captain starts unverified, needs KYC approval
            is_verified: false,
            kyc_status: 'pending'
          });
          if (captainError) {
            console.error("Captain record creation error");
          }
        }

        toast({
          title: "Account created!",
          description: userType === "captain" 
            ? "Please complete KYC verification to start accepting rides."
            : "You can now log in to your account.",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // SECURITY: Only rider and captain options - admin cannot self-register
  const userTypes = [
    { id: "rider" as const, label: "Rider", icon: User, description: "Book rides" },
    { id: "captain" as const, label: "Captain", icon: Bike, description: "Drive & earn" },
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
          {/* User Type Selection - Only for signup */}
          {!isLogin && (
            <div className="flex gap-2 mb-6">
              {userTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setUserType(type.id)}
                  className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl transition-all border-2 ${
                    userType === type.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-card-foreground border-border hover:border-primary/50"
                  }`}
                >
                  <type.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{type.label}</span>
                  <span className="text-[10px] opacity-70">{type.description}</span>
                </button>
              ))}
            </div>
          )}

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
                      maxLength={100}
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
                      maxLength={15}
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
                  maxLength={255}
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
