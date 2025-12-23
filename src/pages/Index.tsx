import { Link } from "react-router-dom";
import { Car, Users, Shield, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-primary rounded-2xl">
              <Car className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            RideShare
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your complete ride-hailing solution. Book rides instantly, track in real-time, and travel safely.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Rider Card */}
          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full w-fit mb-4 group-hover:scale-110 transition-transform">
                <MapPin className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-2xl">Rider</CardTitle>
              <CardDescription>Book rides and travel safely</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                  Real-time captain tracking
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                  Live ETA updates
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                  SOS emergency button
                </li>
              </ul>
              <Link to="/rider" className="block">
                <Button className="w-full" size="lg">
                  Open Rider App
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Captain Card */}
          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 bg-green-100 dark:bg-green-900/30 rounded-full w-fit mb-4 group-hover:scale-110 transition-transform">
                <Car className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl">Captain</CardTitle>
              <CardDescription>Drive and earn money</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                  Turn-by-turn navigation
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                  Voice guidance
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                  Earnings tracking
                </li>
              </ul>
              <Link to="/captain" className="block">
                <Button className="w-full" variant="outline" size="lg">
                  Open Captain App
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Admin Card */}
          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full w-fit mb-4 group-hover:scale-110 transition-transform">
                <Shield className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-2xl">Admin</CardTitle>
              <CardDescription>Manage the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                  KYC verification
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                  Pricing management
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                  Incident handling
                </li>
              </ul>
              <Link to="/admin" className="block">
                <Button className="w-full" variant="secondary" size="lg">
                  Open Admin Panel
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Auth Link */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">Don't have an account?</p>
          <Link to="/auth">
            <Button variant="link" size="lg" className="text-lg">
              <Users className="h-5 w-5 mr-2" />
              Sign Up / Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
