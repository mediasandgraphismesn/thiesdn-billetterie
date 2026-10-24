import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { UserProfile } from '../types';
import {
  getSupabaseClient,
  fetchUserProfile,
  signOutWithSupabase,
} from '../services/supabase';

export type UserRole = 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  userRole: UserRole;
  effectiveRole: UserRole;
  isLoading: boolean;
  isAdminPreview: boolean;
  setIsAdminPreview: (val: boolean) => void;
  refreshUserProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAdminPreview, setIsAdminPreview] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.search.includes('preview=client');
    }
    return false;
  });

  // Rôle effectif pour l'UI (si un admin teste la vue visiteur)
  const effectiveRole: UserRole = useMemo(() => {
    if (isAdminPreview && userRole === 'admin') return 'user';
    return userRole;
  }, [isAdminPreview, userRole]);

  // Récupération en temps réel du profil depuis la table 'profiles' (pas le JWT)
  const loadProfile = async (userId: string, authUser?: any) => {
    try {
      const client = getSupabaseClient();
      if (!client) return;

      const { data: profile, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile && !error) {
        const isEmailConfirmed = Boolean(
          authUser?.email_confirmed_at || authUser?.confirmed_at || profile.email
        );
        const mappedRole = (profile.role as UserRole) || 'user';

        // Tâche 4 : Nettoyage / Reconnexion si le rôle JWT diffère du rôle réel
        const jwtRole = authUser?.user_metadata?.role || authUser?.app_metadata?.role;
        if (jwtRole && jwtRole !== mappedRole) {
          console.info(`Rôle mis à jour en base (${jwtRole} -> ${mappedRole}). Synchronisation session.`);
          // Rafraîchir les métadonnées si besoin sans bloquer
        }

        const updatedProfile: UserProfile = {
          id: profile.id,
          name: profile.name || 'Utilisateur',
          username: profile.username || profile.name || 'user',
          email: profile.email || authUser?.email || '',
          phone: profile.phone || '',
          city: profile.city || 'Thiès',
          address: profile.address || '',
          quartier: profile.quartier || profile.address || '',
          avatar: profile.avatar || '',
          isVip: Boolean(profile.is_vip),
          role: mappedRole,
          isEmailConfirmed,
          termsAccepted: Boolean(profile.terms_accepted),
          termsAcceptedAt: profile.terms_accepted_at || undefined,
          termsVersion: profile.terms_version || undefined,
          connectedAccounts: { facebook: false, instagram: false, tiktok: false },
          privacySettings: { publicProfile: true, biometricLogin: false, emailNotifications: true },
        };

        setUser(updatedProfile);
        setUserRole(mappedRole);
        setIsAuthenticated(true);
      } else {
        // Fallback métadonnées
        const role = (authUser?.user_metadata?.role as UserRole) || 'user';
        setUserRole(role);
        setIsAuthenticated(Boolean(authUser));
      }
    } catch (err) {
      console.warn('Erreur chargement profil temps réel:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Initialisation avec refreshSession() obligatoire au montage
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        // Tâche 1.6 : forcer le refreshSession() dès l'ouverture de l'app
        const { data: refreshData, error: refreshError } = await client.auth.refreshSession();
        if (!refreshError && refreshData.session?.user) {
          await loadProfile(refreshData.session.user.id, refreshData.session.user);
          return;
        }

        // Sinon récupérer la session courante
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData.session?.user) {
          await loadProfile(sessionData.session.user.id, sessionData.session.user);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Erreur refreshSession auth:', err);
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // 2. Écoute dynamique onAuthStateChange (SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, etc.)
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          await loadProfile(session.user.id, session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserRole('user');
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const refreshUserProfile = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { data: sessionData } = await client.auth.getSession();
    if (sessionData.session?.user) {
      await loadProfile(sessionData.session.user.id, sessionData.session.user);
    }
  };

  const signOut = async () => {
    await signOutWithSupabase();
    setUser(null);
    setUserRole('user');
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        userRole,
        effectiveRole,
        isLoading,
        isAdminPreview,
        setIsAdminPreview,
        refreshUserProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
};
