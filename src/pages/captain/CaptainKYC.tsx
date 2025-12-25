import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, Car, Bike, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import DocumentUploadCard from '@/components/captain/DocumentUploadCard';

const requiredDocuments = [
  { type: 'driving_license', label: 'Driving License', description: 'Upload front and back of your DL' },
  { type: 'vehicle_rc', label: 'Vehicle RC', description: 'Registration Certificate of your vehicle' },
  { type: 'insurance', label: 'Vehicle Insurance', description: 'Valid insurance document' },
  { type: 'id_proof', label: 'ID Proof', description: 'Aadhaar or PAN card' },
  { type: 'selfie', label: 'Live Selfie', description: 'A clear photo of yourself' },
];

const vehicleTypeIcons = {
  bike: Bike,
  auto: Truck,
  cab: Car,
};

const CaptainKYC = () => {
  const [captain, setCaptain] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [vehicle, setVehicle] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  
  // Vehicle form state
  const [vehicleType, setVehicleType] = useState<'bike' | 'auto' | 'cab'>('auto');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [year, setYear] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchData = async () => {
    if (!user) return;

    const { data: captainData } = await supabase
      .from('captains')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (captainData) {
      setCaptain(captainData);

      // Fetch documents
      const { data: docs } = await supabase
        .from('captain_documents')
        .select('*')
        .eq('captain_id', captainData.id);

      setDocuments(docs || []);

      // Fetch vehicle
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('*')
        .eq('captain_id', captainData.id)
        .eq('is_active', true)
        .single();

      if (vehicleData) {
        setVehicle(vehicleData);
        setVehicleType(vehicleData.vehicle_type);
        setRegistrationNumber(vehicleData.registration_number);
        setMake(vehicleData.make);
        setModel(vehicleData.model);
        setColor(vehicleData.color || '');
        setYear(vehicleData.year?.toString() || '');
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSaveVehicle = async () => {
    if (!captain?.id) return;

    // Validation
    if (!registrationNumber.trim()) {
      toast({ variant: 'destructive', title: 'Registration number is required' });
      return;
    }
    if (!make.trim()) {
      toast({ variant: 'destructive', title: 'Vehicle make is required' });
      return;
    }
    if (!model.trim()) {
      toast({ variant: 'destructive', title: 'Vehicle model is required' });
      return;
    }

    setIsSavingVehicle(true);

    try {
      if (vehicle) {
        // Update existing vehicle
        const { error } = await supabase
          .from('vehicles')
          .update({
            vehicle_type: vehicleType,
            registration_number: registrationNumber.toUpperCase().trim(),
            make: make.trim(),
            model: model.trim(),
            color: color.trim() || null,
            year: year ? parseInt(year) : null,
          })
          .eq('id', vehicle.id);

        if (error) throw error;
        toast({ title: 'Vehicle updated successfully' });
      } else {
        // Create new vehicle
        const { error } = await supabase
          .from('vehicles')
          .insert({
            captain_id: captain.id,
            vehicle_type: vehicleType,
            registration_number: registrationNumber.toUpperCase().trim(),
            make: make.trim(),
            model: model.trim(),
            color: color.trim() || null,
            year: year ? parseInt(year) : null,
            is_active: true,
          });

        if (error) throw error;
        toast({ title: 'Vehicle registered successfully' });
      }

      fetchData();
    } catch (error: any) {
      console.error('Vehicle save error:', error);
      toast({ variant: 'destructive', title: 'Failed to save vehicle', description: error.message });
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const getDocumentByType = (type: string) => {
    return documents.find((d) => d.document_type === type);
  };

  const approvedCount = documents.filter((d) => d.status === 'approved').length;
  const progress = (approvedCount / requiredDocuments.length) * 100;
  const allApproved = approvedCount === requiredDocuments.length;
  const hasVehicle = !!vehicle;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const VehicleIcon = vehicleTypeIcons[vehicleType];

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="mobile-header">
        <Button variant="ghost" size="icon" onClick={() => navigate('/captain')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-display font-bold text-lg">Verification</h1>
        <div className="w-10" />
      </header>

      <div className="p-4 space-y-6">
        {/* Status Card */}
        <div className={`rounded-xl p-4 ${
          allApproved && hasVehicle
            ? 'bg-success/10 border border-success/30' 
            : captain?.kyc_status === 'rejected'
            ? 'bg-destructive/10 border border-destructive/30'
            : 'bg-warning/10 border border-warning/30'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            {allApproved && hasVehicle ? (
              <CheckCircle className="w-6 h-6 text-success" />
            ) : captain?.kyc_status === 'rejected' ? (
              <AlertCircle className="w-6 h-6 text-destructive" />
            ) : (
              <Clock className="w-6 h-6 text-warning" />
            )}
            <div>
              <h2 className="font-semibold">
                {allApproved && hasVehicle
                  ? 'Verification Complete!' 
                  : captain?.kyc_status === 'rejected'
                  ? 'Verification Failed'
                  : 'Verification in Progress'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {allApproved && hasVehicle
                  ? 'You can now start accepting rides' 
                  : !hasVehicle
                  ? 'Please register your vehicle first'
                  : `${approvedCount} of ${requiredDocuments.length} documents verified`}
              </p>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Vehicle Registration Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <VehicleIcon className="w-5 h-5" />
              {vehicle ? 'Your Vehicle' : 'Register Your Vehicle'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vehicle && (
              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                <p className="text-sm text-muted-foreground">{vehicle.registration_number}</p>
                <p className="text-xs text-muted-foreground capitalize">{vehicle.vehicle_type} • {vehicle.color || 'No color'}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label>Vehicle Type *</Label>
                <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bike">Bike</SelectItem>
                    <SelectItem value="auto">Auto Rickshaw</SelectItem>
                    <SelectItem value="cab">Cab / Car</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Registration Number *</Label>
                <Input
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                  placeholder="KA01AB1234"
                  className="uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Make *</Label>
                  <Input
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Honda, Bajaj, Maruti..."
                  />
                </div>
                <div>
                  <Label>Model *</Label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Activa, Auto, Swift..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Color</Label>
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Yellow, White..."
                  />
                </div>
                <div>
                  <Label>Year</Label>
                  <Input
                    value={year}
                    onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
                    placeholder="2020"
                    maxLength={4}
                  />
                </div>
              </div>

              <Button 
                onClick={handleSaveVehicle} 
                className="w-full"
                disabled={isSavingVehicle}
              >
                {isSavingVehicle ? 'Saving...' : vehicle ? 'Update Vehicle' : 'Register Vehicle'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documents Section - Only show if vehicle is registered */}
        {hasVehicle ? (
          <div className="space-y-4">
            <h3 className="font-semibold">Required Documents</h3>
            {requiredDocuments.map((doc) => (
              <DocumentUploadCard
                key={doc.type}
                captainId={captain?.id}
                userId={user?.id || ''}
                documentType={doc.type}
                label={doc.label}
                description={doc.description}
                existingDocument={getDocumentByType(doc.type)}
                onUploadComplete={fetchData}
              />
            ))}
          </div>
        ) : (
          <div className="bg-muted/50 rounded-xl p-6 text-center">
            <Car className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium mb-1">Register Vehicle First</p>
            <p className="text-sm text-muted-foreground">
              Please register your vehicle above before uploading documents
            </p>
          </div>
        )}

        {allApproved && hasVehicle && (
          <Button onClick={() => navigate('/captain')} className="w-full">
            Start Accepting Rides
          </Button>
        )}
      </div>
    </div>
  );
};

export default CaptainKYC;
