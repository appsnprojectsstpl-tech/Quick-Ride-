import { useState } from 'react';
import { Camera, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EditProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    name: string | null;
    phone: string;
    email: string | null;
    avatar_url: string | null;
    user_id: string;
  } | null;
  onUpdated: () => void;
}

const EditProfileDialog = ({
  isOpen,
  onClose,
  profile,
  onUpdated,
}: EditProfileDialogProps) => {
  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSubmitting(true);

    try {
      let avatarUrl = profile.avatar_url;

      // Upload avatar if changed
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${profile.user_id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('captain-documents')
          .upload(`avatars/${fileName}`, avatarFile);

        if (!uploadError) {
          const { data } = supabase.storage
            .from('captain-documents')
            .getPublicUrl(`avatars/${fileName}`);
          avatarUrl = data.publicUrl;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          name,
          phone,
          avatar_url: avatarUrl,
        })
        .eq('user_id', profile.user_id);

      if (error) throw error;

      toast({
        title: 'Profile updated!',
        description: 'Your changes have been saved.',
      });

      onUpdated();
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={avatarPreview || profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar"
                className="absolute bottom-0 right-0 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90"
              >
                <Camera className="w-4 h-4 text-primary-foreground" />
                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={profile?.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email cannot be changed
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileDialog;
