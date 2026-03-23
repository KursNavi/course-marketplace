import React, { useState, useEffect } from 'react';
import {
  Save, Loader, Globe, Image, FileText, Mail, Eye, EyeOff,
  CheckCircle, AlertCircle, ExternalLink, Calendar, Info, Settings,
  MapPin, Plus, XCircle, Lock, ChevronDown, User, PenTool, Shield, Trash2, CreditCard
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BASE_URL, generateProviderSlug } from '../lib/siteConfig';
import { SWISS_CANTONS } from '../lib/constants';
import {
  hasPublicProfile, canPublishProfile, canEditSlug, hasCoverImage
} from '../lib/entitlements';

import { DEFAULT_COVER_IMAGE } from '../lib/imageUtils';

/**
 * Consolidated Profile Editor Component
 * Combines basic profile settings with public provider profile
 *
 * For all teachers: Basic profile fields (name, location, bio, etc.)
 * For Pro+ teachers: Additional public profile features (logo, slug, publish)
 */
export default function ProviderProfileEditor({ user, showNotification, setUser, setLang, t }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Combined profile data
  const [profileData, setProfileData] = useState({
    // Basic fields (all teachers)
    full_name: '',
    city: '',
    canton: '',
    bio_text: '',
    certificates: '',
    preferred_language: 'de',
    website_url: '',
    email: user?.email || '',
    password: '',
    confirmPassword: '',
    // Public profile fields (Pro+)
    slug: '',
    logo_url: '',
    cover_image_url: '',
    show_email_publicly: false,
    profile_published_at: null,
    last_slug_change_at: null,
    package_tier: 'basic',
    verification_status: 'none'
  });

  const [additionalLocations, setAdditionalLocations] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Course statistics for the public profile hint
  const [courseStats, setCourseStats] = useState({ total: 0, published: 0, draft: 0 });

  // Slug validation
  const [slugValidation, setSlugValidation] = useState({
    checking: false,
    valid: true,
    available: true,
    canChange: true,
    error: null,
    suggestions: []
  });

  const [editingSlug, setEditingSlug] = useState(false);
  const [newSlug, setNewSlug] = useState('');

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Stripe Connect state
  const [stripeConnectAccountId, setStripeConnectAccountId] = useState(null);
  const [stripeConnectOnboardingComplete, setStripeConnectOnboardingComplete] = useState(false);

  // Derived states
  const tier = profileData.package_tier;
  const isEligible = hasPublicProfile(tier);
  const canPublish = canPublishProfile(tier);
  const canChangeSlug = canEditSlug(tier);
  const showCoverImage = hasCoverImage(tier);
  const isPublished = !!profileData.profile_published_at;
  const isTeacher = user?.role === 'teacher';

  // Load profile data
  useEffect(() => {
    if (!user?.id) return;

    const loadProfile = async () => {
      try {
        setLoading(true);

        // Base columns that always exist
        const baseColumns = `
          full_name, city, canton, bio_text, certificates,
          preferred_language, website_url, additional_locations,
          verification_status, package_tier,
          stripe_connect_account_id, stripe_connect_onboarding_complete
        `;

        // Optional columns from migration (may not exist yet)
        const optionalColumns = ['slug', 'logo_url', 'cover_image_url', 'show_email_publicly', 'profile_published_at', 'last_slug_change_at'];

        // Try with all columns first
        let { data, error } = await supabase
          .from('profiles')
          .select(`${baseColumns}, ${optionalColumns.join(', ')}`)
          .eq('id', user.id)
          .single();

        // If query fails, try with just base columns
        if (error) {
          console.warn('Full query failed, trying with base columns only:', error.message);
          const fallback = await supabase
            .from('profiles')
            .select(baseColumns)
            .eq('id', user.id)
            .single();

          if (fallback.error) throw fallback.error;

          // Set defaults for missing optional columns
          data = {
            ...fallback.data,
            slug: '',
            logo_url: '',
            cover_image_url: '',
            show_email_publicly: false,
            profile_published_at: null,
            last_slug_change_at: null
          };
        }

        setProfileData({
          full_name: data.full_name || '',
          city: data.city || '',
          canton: data.canton || '',
          bio_text: data.bio_text || '',
          certificates: Array.isArray(data.certificates) ? data.certificates.join('\n') : '',
          preferred_language: data.preferred_language || 'de',
          website_url: data.website_url || '',
          email: user.email || '',
          password: '',
          confirmPassword: '',
          slug: data.slug || '',
          logo_url: data.logo_url || '',
          cover_image_url: data.cover_image_url || '',
          show_email_publicly: data.show_email_publicly || false,
          profile_published_at: data.profile_published_at,
          last_slug_change_at: data.last_slug_change_at,
          package_tier: data.package_tier || 'basic',
          verification_status: data.verification_status || 'none'
        });

        setNewSlug(data.slug || '');

        // Stripe Connect
        setStripeConnectAccountId(data.stripe_connect_account_id || null);
        setStripeConnectOnboardingComplete(data.stripe_connect_onboarding_complete || false);

        // Parse additional_locations
        if (data.additional_locations) {
          try {
            const parsed = JSON.parse(data.additional_locations);
            if (Array.isArray(parsed)) setAdditionalLocations(parsed);
          } catch {
            const items = data.additional_locations.split(',').map(s => s.trim()).filter(Boolean);
            setAdditionalLocations(items.map(city => ({ city, canton: '' })));
          }
        }

        // Load course statistics for visibility hint
        const { data: courses } = await supabase
          .from('courses')
          .select('id, status')
          .eq('user_id', user.id);

        if (courses) {
          const published = courses.filter(c => c.status === 'published' || c.status === null || c.status === undefined).length;
          const draft = courses.filter(c => c.status === 'draft').length;
          setCourseStats({ total: courses.length, published, draft });
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        showNotification?.('Fehler beim Laden des Profils', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id]);

  // Check for Stripe Connect return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connectStatus = urlParams.get('connect');

    if (connectStatus === 'success' && user?.id) {
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) return;
          const response = await fetch('/api/stripe-management', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ action: 'check_connect_status' })
          });
          const data = await response.json();
          if (data.onboardingComplete) {
            setStripeConnectOnboardingComplete(true);
            showNotification?.("Auszahlungskonto erfolgreich eingerichtet!", "success");
          }
        } catch (error) {
          console.error('Error checking connect status:', error);
        }
        // Clean up URL
        const url = new URL(window.location);
        url.searchParams.delete('connect');
        window.history.replaceState({}, '', url);
      })();
    }
  }, [user?.id]);

  // Validate slug
  const validateSlug = async (slug) => {
    if (!slug) {
      setSlugValidation({ ...slugValidation, valid: false, error: 'Slug ist erforderlich' });
      return;
    }

    setSlugValidation({ ...slugValidation, checking: true });

    try {
      const response = await fetch('/api/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate-slug', slug, providerId: user.id })
      });

      const data = await response.json();

      setSlugValidation({
        checking: false,
        valid: data.valid,
        available: data.available,
        canChange: data.canChange,
        error: data.error,
        suggestions: data.suggestions || [],
        cooldownEnds: data.cooldownEnds
      });
    } catch (err) {
      console.error('Error validating slug:', err);
      setSlugValidation({
        ...slugValidation,
        checking: false,
        error: 'Fehler bei der Validierung'
      });
    }
  };

  // Debounced slug validation
  useEffect(() => {
    if (!editingSlug || newSlug === profileData.slug) return;

    const timer = setTimeout(() => {
      validateSlug(newSlug);
    }, 500);

    return () => clearTimeout(timer);
  }, [newSlug, editingSlug]);

  // Save profile
  const handleSave = async (e) => {
    e?.preventDefault();

    try {
      setSaving(true);

      // Validate passwords if changing
      if (profileData.password && profileData.password !== profileData.confirmPassword) {
        showNotification?.('Passwörter stimmen nicht überein', 'error');
        setSaving(false);
        return;
      }

      // Prepare profile updates
      const certArray = (profileData.certificates || '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      let formattedUrl = profileData.website_url?.trim() || '';
      if (formattedUrl && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const validLocations = additionalLocations.filter(loc => loc.city.trim());

      const profileUpdates = {
        full_name: profileData.full_name,
        city: profileData.city,
        canton: profileData.canton,
        preferred_language: profileData.preferred_language,
        bio_text: profileData.bio_text,
        certificates: certArray,
        website_url: formattedUrl,
        additional_locations: validLocations.length > 0 ? JSON.stringify(validLocations) : '',
        logo_url: profileData.logo_url,
        show_email_publicly: profileData.show_email_publicly,
        email: profileData.email
      };

      // Include cover image only for Enterprise
      if (showCoverImage) {
        profileUpdates.cover_image_url = profileData.cover_image_url;
      }

      // Update slug if changed and valid
      if (editingSlug && newSlug !== profileData.slug && slugValidation.valid && slugValidation.available && slugValidation.canChange) {
        profileUpdates.slug = newSlug;
      }

      // Try to update with all fields, with progressive fallback for missing columns
      let { error } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id);

      // If update fails, try removing potentially missing columns one by one
      if (error) {
        console.warn('Full update failed:', error.message);

        // List of columns that might not exist yet (from migration)
        const optionalColumns = ['show_email_publicly', 'logo_url', 'cover_image_url'];
        let lastError = error;

        for (const col of optionalColumns) {
          if (profileUpdates[col] !== undefined) {
            delete profileUpdates[col];
            console.warn(`Retrying without ${col}`);

            const retry = await supabase
              .from('profiles')
              .update(profileUpdates)
              .eq('id', user.id);

            if (!retry.error) {
              lastError = null;
              break;
            }
            lastError = retry.error;
          }
        }

        if (lastError) throw lastError;
      }

      // Update local state
      if (profileUpdates.slug) {
        setProfileData(prev => ({ ...prev, slug: profileUpdates.slug }));
        setEditingSlug(false);
      }

      // Update auth metadata with new name
      if (profileData.full_name) {
        await supabase.auth.updateUser({
          data: { full_name: profileData.full_name }
        });
      }

      // Update instructor_name on all courses
      if (isTeacher && profileData.full_name) {
        await supabase
          .from('courses')
          .update({ instructor_name: profileData.full_name })
          .eq('user_id', user.id);
      }

      // Handle email/password changes
      if (profileData.email !== user.email || profileData.password) {
        if (profileData.password && profileData.password !== profileData.confirmPassword) {
          showNotification?.('Passwörter stimmen nicht überein', 'error');
          return;
        }
        const updates = {};
        const emailChanged = profileData.email !== user.email;
        if (emailChanged) updates.email = profileData.email;
        if (profileData.password) updates.password = profileData.password;

        const { error: authError } = await supabase.auth.updateUser(updates, {
          emailRedirectTo: 'https://kursnavi.ch'
        });
        if (authError) {
          showNotification?.('Fehler beim Aktualisieren des Kontos: ' + authError.message, 'error');
        } else if (emailChanged && !profileData.password) {
          showNotification?.('Bestätigungs-E-Mail wurde an ' + profileData.email + ' gesendet. Bitte bestätigen Sie die neue Adresse.', 'success');
        } else if (emailChanged && profileData.password) {
          showNotification?.('Passwort aktualisiert. Bestätigungs-E-Mail wurde an ' + profileData.email + ' gesendet.', 'success');
        } else {
          showNotification?.('Passwort aktualisiert', 'success');
        }
      } else {
        showNotification?.('Profil gespeichert', 'success');
      }

      // Update local user state with new name
      if (profileData.full_name && setUser) {
        setUser(prev => prev ? { ...prev, name: profileData.full_name } : prev);
      }

      setLang?.(profileData.preferred_language);
    } catch (err) {
      console.error('Error saving profile:', err);
      showNotification?.('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Publish/Unpublish profile via server API (service role bypasses RLS)
  const togglePublish = async () => {
    if (!canPublish) return;

    try {
      setSaving(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showNotification?.('Sitzung abgelaufen – bitte Seite neu laden', 'error');
        return;
      }

      const res = await fetch('/api/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-publish',
          providerId: session.user.id,
          authToken: session.access_token,
          publish: !isPublished
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update fehlgeschlagen');
      }

      const result = await res.json();

      setProfileData(prev => ({
        ...prev,
        profile_published_at: result.profile_published_at,
        slug: result.slug || prev.slug
      }));

      if (result.slug && !profileData.slug) {
        setNewSlug(result.slug);
      }

      showNotification?.(
        isPublished ? 'Profil ist jetzt offline' : 'Profil wurde veröffentlicht!',
        'success'
      );
    } catch (err) {
      console.error('Error toggling publish:', err);
      showNotification?.(err.message || 'Fehler beim Aktualisieren', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle image upload (logo or cover)
  const handleImageUpload = async (file, type) => {
    if (!file) return;

    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingCover;
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (file.size > maxSize) {
      showNotification?.('Bild darf maximal 2MB gross sein', 'error');
      return;
    }

    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      // Use existing course-images bucket with providers/ prefix
      const fileName = `providers/${user.id}/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('course-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('course-images')
        .getPublicUrl(fileName);

      const fieldName = type === 'logo' ? 'logo_url' : 'cover_image_url';
      const publicUrl = urlData.publicUrl;

      // Update local state
      setProfileData(prev => ({ ...prev, [fieldName]: publicUrl }));

      // Also save directly to database
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ [fieldName]: publicUrl })
        .eq('id', user.id);

      if (dbError) {
        console.warn('Could not save image URL to database:', dbError.message);
        showNotification?.('Bild hochgeladen (bitte Profil speichern)', 'warning');
      } else {
        showNotification?.('Bild hochgeladen und gespeichert', 'success');
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      showNotification?.('Fehler beim Hochladen: ' + (err.message || 'Unbekannter Fehler'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  // Delete account handler
  const handleDeleteAccount = async () => {
    if (!deletePassword) return;

    try {
      setDeleting(true);
      setDeleteError('');

      // Verify password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword
      });

      if (signInError) {
        setDeleteError('Falsches Passwort. Bitte versuchen Sie es erneut.');
        setDeleting(false);
        return;
      }

      // Call the delete account RPC function
      const { error: rpcError } = await supabase.rpc('delete_provider_account', {
        provider_id: user.id
      });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        // Fallback: manually delete in order if RPC doesn't exist
        if (rpcError.code === 'PGRST202') {
          // Delete course_category_assignments (via courses)
          const { data: courses } = await supabase
            .from('courses')
            .select('id')
            .eq('user_id', user.id);

          if (courses?.length > 0) {
            const courseIds = courses.map(c => c.id);

            // Delete course_category_assignments
            await supabase
              .from('course_category_assignments')
              .delete()
              .in('course_id', courseIds);

            // Delete ticket_periods
            await supabase
              .from('ticket_periods')
              .delete()
              .in('course_id', courseIds);

            // Delete bookings (via course_events)
            const { data: events } = await supabase
              .from('course_events')
              .select('id')
              .in('course_id', courseIds);

            if (events?.length > 0) {
              await supabase
                .from('bookings')
                .delete()
                .in('event_id', events.map(e => e.id));
            }

            // Delete course_events
            await supabase
              .from('course_events')
              .delete()
              .in('course_id', courseIds);

            // Delete courses
            await supabase
              .from('courses')
              .delete()
              .eq('user_id', user.id);
          }

          // Delete provider_slug_aliases
          await supabase
            .from('provider_slug_aliases')
            .delete()
            .eq('provider_id', user.id);

          // Delete profile
          await supabase
            .from('profiles')
            .delete()
            .eq('id', user.id);
        } else {
          throw rpcError;
        }
      }

      // Delete the auth user via server-side API (requires service role key)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const response = await fetch('/api/delete-account', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) {
          const result = await response.json();
          console.error('Failed to delete auth user:', result.error);
        }
      }

      // Sign out the user
      await supabase.auth.signOut();

      showNotification?.('Ihr Konto wurde erfolgreich gelöscht', 'success');

      // Redirect to homepage
      window.location.href = '/';
    } catch (err) {
      console.error('Error deleting account:', err);
      showNotification?.('Fehler beim Löschen des Kontos: ' + (err.message || 'Unbekannter Fehler'), 'error');
      setDeleting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 text-orange-500 animate-spin" />
        <span className="ml-2 text-gray-600">Wird geladen...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Public Profile Status Banner (Pro+ only) */}
      {isEligible && (
        <div className={`rounded-xl p-4 flex items-center justify-between ${isPublished ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center gap-3">
            {isPublished ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            )}
            <div>
              <p className={`font-medium ${isPublished ? 'text-green-700' : 'text-yellow-700'}`}>
                {isPublished ? 'Ihr Profil ist öffentlich' : 'Ihr Profil ist noch nicht veröffentlicht'}
              </p>
              {isPublished && profileData.slug && (
                <a
                  href={`${BASE_URL}/anbieter/${profileData.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="text-sm text-green-600 hover:underline flex items-center gap-1"
                >
                  {BASE_URL}/anbieter/{profileData.slug}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <button
            onClick={togglePublish}
            disabled={saving}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isPublished
                ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : (
              isPublished ? 'Offline nehmen' : 'Jetzt veröffentlichen'
            )}
          </button>
        </div>
      )}

      {/* Course visibility warning - show when profile is published but no courses are visible */}
      {isEligible && isPublished && courseStats.total > 0 && courseStats.published === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">
                Keine veröffentlichten Kurse sichtbar
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Sie haben {courseStats.draft} Kurs{courseStats.draft !== 1 ? 'e' : ''} als Entwurf gespeichert.
                Auf Ihrem öffentlichen Profil werden nur veröffentlichte Kurse angezeigt.
              </p>
              <p className="text-sm text-amber-700 mt-2">
                <strong>Tipp:</strong> Gehen Sie zu "Meine Kurse" und ändern Sie den Status auf "Veröffentlicht",
                damit Ihre Kurse auf Ihrem Profil erscheinen.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Course stats info - show when profile is published and some courses are visible */}
      {isEligible && isPublished && courseStats.published > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm text-blue-700">
                <strong>{courseStats.published}</strong> {courseStats.published === 1 ? 'Kurs wird' : 'Kurse werden'} auf Ihrem öffentlichen Profil angezeigt.
                {courseStats.draft > 0 && (
                  <span className="text-blue-600"> ({courseStats.draft} weitere{courseStats.draft === 1 ? 'r' : ''} als Entwurf)</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Notice for Basic tier */}
      {!isEligible && isTeacher && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-orange-500 mt-0.5" />
            <div>
              <p className="font-medium text-orange-800">
                Öffentliches Profil verfügbar ab Pro
              </p>
              <p className="text-sm text-orange-700 mt-1">
                Mit einem Pro-Paket erscheinen Sie im Anbieter-Verzeichnis und können Ihr Profil veröffentlichen.
              </p>
              <button
                onClick={() => window.location.href = '/teacher-hub'}
                className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                Pakete vergleichen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-gray-500" />
          {t?.profile_settings || 'Profil-Einstellungen'}
        </h2>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {isTeacher ? 'Anbieter- / Anzeigename' : 'Name'}
            </label>
            <input
              type="text"
              name="full_name"
              value={profileData.full_name}
              onChange={handleChange}
              placeholder="z.B. Max Mustermann oder Firma GmbH"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
            />
            {isTeacher && (
              <p className="text-xs text-gray-400 mt-1 italic">
                Dieser Name wird auf Ihrem Profil und bei Ihren Kursen angezeigt.
              </p>
            )}
            {isTeacher && profileData.full_name?.length > 25 && (
              <p className="text-xs text-amber-600 mt-1">
                Wir empfehlen max. 25 Zeichen ({profileData.full_name.length}/25) – bei längeren Namen wird der Anzeigename auf der Plattform je nach Darstellung mit „..." abgekürzt.
              </p>
            )}
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                {isTeacher ? (t?.lbl_main_location || 'Hauptstandort') : 'Standort'}
              </label>
              <input
                type="text"
                name="city"
                value={profileData.city}
                onChange={handleChange}
                placeholder="Stadt"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                {t?.lbl_canton || 'Kanton'}
              </label>
              <div className="relative">
                <select
                  name="canton"
                  value={profileData.canton}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none appearance-none bg-white"
                >
                  <option value="">Kanton wählen</option>
                  {SWISS_CANTONS.filter(c => c !== 'Online').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Additional Locations (Teachers only) */}
          {isTeacher && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                {t?.lbl_additional_locations || 'Weitere Standorte'}
              </label>
              <div className="space-y-2">
                {additionalLocations.map((loc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={loc.city}
                      onChange={(e) => {
                        const updated = [...additionalLocations];
                        updated[idx] = { ...updated[idx], city: e.target.value };
                        setAdditionalLocations(updated);
                      }}
                      placeholder="Stadt / Ort"
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"
                    />
                    <div className="relative">
                      <select
                        value={loc.canton}
                        onChange={(e) => {
                          const updated = [...additionalLocations];
                          updated[idx] = { ...updated[idx], canton: e.target.value };
                          setAdditionalLocations(updated);
                        }}
                        className="w-40 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none appearance-none bg-white"
                      >
                        <option value="">Kanton</option>
                        {SWISS_CANTONS.filter(c => c !== 'Online').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdditionalLocations(additionalLocations.filter((_, i) => i !== idx))}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Standort entfernen"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAdditionalLocations([...additionalLocations, { city: '', canton: '' }])}
                className="mt-2 text-sm font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition"
              >
                <Plus className="w-4 h-4" /> Standort hinzufügen
              </button>
            </div>
          )}

          {/* Website */}
          {isTeacher && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Unternehmens-Website</label>
              <div className="relative">
                <input
                  type="text"
                  name="website_url"
                  value={profileData.website_url}
                  onChange={handleChange}
                  placeholder="z.B. www.ihre-seite.ch"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"
                />
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              </div>
            </div>
          )}

          {/* Profile URL / Slug (Pro+ only) */}
          {isEligible && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Profil-URL
              </label>
              {editingSlug ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center bg-gray-50 rounded-lg border border-gray-200 px-3">
                      <span className="text-gray-500 text-sm">{BASE_URL}/anbieter/</span>
                      <input
                        type="text"
                        value={newSlug}
                        onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="flex-1 bg-transparent py-2.5 outline-none text-sm"
                        placeholder="meine-schule"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSlug(false);
                        setNewSlug(profileData.slug);
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Abbrechen
                    </button>
                  </div>

                  {slugValidation.checking && (
                    <p className="text-sm text-gray-500 flex items-center">
                      <Loader className="w-3 h-3 mr-1 animate-spin" />
                      Wird geprüft...
                    </p>
                  )}
                  {slugValidation.error && (
                    <p className="text-sm text-red-600">{slugValidation.error}</p>
                  )}
                  {!slugValidation.available && slugValidation.suggestions?.length > 0 && (
                    <div className="text-sm">
                      <p className="text-red-600 mb-1">Diese URL ist bereits vergeben. Alternativen:</p>
                      <div className="flex gap-2">
                        {slugValidation.suggestions.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setNewSlug(s)}
                            className="text-orange-600 hover:underline"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {!slugValidation.canChange && slugValidation.cooldownEnds && (
                    <p className="text-sm text-yellow-600 flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Sie können Ihre URL erst wieder am {new Date(slugValidation.cooldownEnds).toLocaleDateString('de-CH')} ändern.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 bg-gray-50 px-4 py-2.5 rounded-lg border border-gray-200 flex-1 text-sm">
                    {profileData.slug ? (
                      <>{BASE_URL}/anbieter/{profileData.slug}</>
                    ) : (
                      <span className="text-gray-400">Wird beim Veröffentlichen automatisch erstellt</span>
                    )}
                  </span>
                  {canChangeSlug && profileData.slug && (
                    <button
                      type="button"
                      onClick={() => setEditingSlug(true)}
                      className="px-4 py-2.5 text-orange-600 hover:text-orange-700 font-medium text-sm"
                    >
                      Ändern
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Die URL wird automatisch aus Ihrem Namen generiert und kann max. einmal pro Monat geändert werden.
              </p>
            </div>
          )}

          {/* Logo (Pro+ only) */}
          {isEligible && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Logo
              </label>
              <div className="flex items-start gap-4">
                {profileData.logo_url ? (
                  <img
                    src={profileData.logo_url}
                    alt={`${profileData.name || 'Anbieter'} Logo`}
                    className="w-20 h-20 rounded-xl object-contain bg-white border border-gray-200 p-1"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Image className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <label className="cursor-pointer">
                    <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-flex items-center text-sm">
                      {uploadingLogo ? (
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Image className="w-4 h-4 mr-2" />
                      )}
                      Logo hochladen
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e.target.files[0], 'logo')}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Empfohlen: 200x200px, max 2MB
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cover Image (Enterprise only) */}
          {showCoverImage && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Cover-Bild
                <span className="ml-2 text-xs text-orange-500 font-normal">(Enterprise)</span>
              </label>
              <div className="space-y-3">
                <img
                  src={profileData.cover_image_url || DEFAULT_COVER_IMAGE}
                  alt={`${profileData.name || 'Anbieter'} Coverbild`}
                  className="w-full h-40 rounded-xl object-cover border border-gray-200"
                />
                <label className="cursor-pointer inline-block">
                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-flex items-center text-sm">
                    {uploadingCover ? (
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Image className="w-4 h-4 mr-2" />
                    )}
                    Cover hochladen
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e.target.files[0], 'cover')}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500">
                  Empfohlen: 1200x400px, max 2MB
                </p>
              </div>
            </div>
          )}

          {/* Bio / Description */}
          {isTeacher && (
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center">
                <User className="w-5 h-5 mr-2 text-orange-500" />
                {t?.lbl_bio || 'Über mich / uns (Bio / Anbietervorstellung)'}
              </h3>
              <textarea
                name="bio_text"
                rows="5"
                value={profileData.bio_text}
                onChange={handleChange}
                placeholder="Erzählen Sie etwas über Ihre Erfahrung, Qualifikationen und was Sie auszeichnet..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none resize-y bg-gray-50 focus:bg-white transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">
                Diese Beschreibung wird auf Ihrem öffentlichen Profil angezeigt.
              </p>
            </div>
          )}

          {/* Certificates */}
          {isTeacher && (
            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center">
                <PenTool className="w-5 h-5 mr-2 text-orange-500" />
                {t?.lbl_qualifications || 'Zertifikate & Qualifikationen'}
              </h3>
              <textarea
                name="certificates"
                rows="3"
                value={profileData.certificates}
                onChange={handleChange}
                placeholder="z.B. Master in Pädagogik&#10;Dipl. Yoga Instruktor..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
          )}

          {/* Email Visibility Toggle (Pro+ only) */}
          {isEligible && (
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center">
                <Mail className="w-5 h-5 mr-2 text-orange-500" />
                Kontakteinstellungen
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={profileData.show_email_publicly}
                      onChange={(e) => setProfileData(prev => ({ ...prev, show_email_publicly: e.target.checked }))}
                      className="w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">E-Mail-Adresse öffentlich anzeigen</span>
                    <p className="text-sm text-gray-600 mt-1">
                      {profileData.show_email_publicly ? (
                        <>Ihre E-Mail-Adresse (<strong>{user?.email}</strong>) wird auf Ihrem öffentlichen Profil angezeigt.</>
                      ) : (
                        <>Besucher können Sie nur über das Kontaktformular erreichen.</>
                      )}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Language */}
          <div className="border-t pt-6 mt-6">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {t?.lbl_language || 'Bevorzugte Sprache'}
            </label>
            <div className="relative">
              <select
                name="preferred_language"
                value={profileData.preferred_language}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none appearance-none bg-white"
              >
                <option value="de">Deutsch (German)</option>
                <option value="en">English</option>
                <option value="fr">Français (French)</option>
                <option value="it">Italiano (Italian)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            </div>
          </div>

          {/* Account Security */}
          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center">
              <Lock className="w-4 h-4 mr-2" />
              {t?.lbl_account_security || 'Account-Sicherheit'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none bg-gray-50"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    {t?.lbl_new_password || 'Neues Passwort'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={profileData.password}
                      onChange={handleChange}
                      placeholder="******"
                      className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    {t?.lbl_confirm_password || 'Passwort bestätigen'}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={profileData.confirmPassword}
                      onChange={handleChange}
                      placeholder="******"
                      className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors flex items-center shadow-md disabled:opacity-50"
            >
              {saving ? (
                <Loader className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {t?.btn_save || 'Änderungen speichern'}
            </button>
          </div>
        </form>
      </div>

      {/* Stripe Connect - Auszahlungen für Anbieter */}
      {isTeacher && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-orange-500" /> Auszahlungen einrichten
          </h3>

          {stripeConnectOnboardingComplete ? (
            <div className="bg-green-50 p-6 rounded-xl border border-green-200">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-6 h-6 text-green-600 mt-1 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-green-900 mb-2">Auszahlungen aktiviert</h4>
                  <p className="text-sm text-green-800 mb-4">
                    Dein Auszahlungskonto ist eingerichtet. Du kannst jetzt Zahlungen von Kursbuchungen empfangen.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session?.access_token) throw new Error('Nicht authentifiziert');
                        const response = await fetch('/api/stripe-management', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                          },
                          body: JSON.stringify({
                            action: 'connect_dashboard_link',
                            accountId: stripeConnectAccountId
                          })
                        });
                        const data = await response.json();
                        if (data.url) {
                          window.open(data.url, '_blank');
                        } else {
                          showNotification?.("Fehler beim Öffnen des Dashboards", "error");
                        }
                      } catch (error) {
                        console.error('Error opening connect dashboard:', error);
                        showNotification?.("Fehler beim Öffnen des Dashboards", "error");
                      }
                    }}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition shadow-md text-sm"
                  >
                    Auszahlungs-Dashboard öffnen
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-orange-600 mt-1 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-orange-900 mb-2">Bankverbindung hinterlegen</h4>
                  <p className="text-sm text-orange-800 mb-4">
                    Um Zahlungen von Kursbuchungen zu empfangen, musst du deine Bankdaten bei Stripe hinterlegen.
                    Dies ist einmalig und dauert nur wenige Minuten.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user?.id || !user?.email) {
                        showNotification?.("Bitte melde dich erneut an und versuche es nochmal.", "error");
                        return;
                      }
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session?.access_token) throw new Error('Nicht authentifiziert');
                        const response = await fetch('/api/stripe-management', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                          },
                          body: JSON.stringify({
                            action: 'create_connect_account'
                          })
                        });
                        const data = await response.json();
                        if (data.url) {
                          window.location.href = data.url;
                        } else {
                          console.error('Stripe connect error:', data);
                          showNotification?.(data.error || "Fehler beim Erstellen des Onboarding-Links", "error");
                        }
                      } catch (error) {
                        console.error('Error creating connect account:', error);
                        showNotification?.("Fehler beim Erstellen des Kontos", "error");
                      }
                    }}
                    className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition shadow-md text-sm"
                  >
                    Jetzt einrichten
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Account Section */}
      <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 md:p-8">
        <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center">
          <Trash2 className="w-5 h-5 mr-2" />
          Konto löschen
        </h3>
        <p className="text-gray-600 mb-4">
          Wenn Sie Ihr Konto löschen, werden alle Ihre Daten unwiderruflich entfernt. Dies umfasst:
        </p>
        <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1 text-sm">
          <li>Ihr Profil und alle Einstellungen</li>
          <li>Alle Ihre Kurse und Kurstermine</li>
          <li>Buchungsdaten und Teilnehmerlisten</li>
          <li>Hochgeladene Bilder und Dokumente</li>
        </ul>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Konto unwiderruflich löschen
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Konto löschen?</h3>
                <p className="text-sm text-gray-500">Diese Aktion kann nicht rückgängig gemacht werden</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700">
                <strong>Achtung:</strong> Alle Ihre Daten werden permanent gelöscht, einschliesslich aller Kurse, Buchungen und Ihres Profils.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Geben Sie Ihr Passwort ein, um zu bestätigen:
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setDeleteError('');
                }}
                placeholder="Ihr Passwort"
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none ${
                  deleteError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                autoComplete="current-password"
              />
              {deleteError && (
                <p className="text-sm text-red-600 mt-2">{deleteError}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={!deletePassword || deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {deleting ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Wird gelöscht...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Endgültig löschen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
