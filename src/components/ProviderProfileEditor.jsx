import React, { useState, useEffect } from 'react';
import {
  Save, Loader, Globe, Image, FileText, Mail, Eye, EyeOff,
  CheckCircle, AlertCircle, ExternalLink, Calendar, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BASE_URL, generateProviderSlug } from '../lib/siteConfig';
import {
  hasPublicProfile, canPublishProfile, canEditSlug, hasCoverImage, getTierLabel
} from '../lib/entitlements';

/**
 * ProviderProfileEditor Component
 * Dashboard section for editing the public provider profile
 *
 * Features:
 * - Description, logo, cover image (Enterprise)
 * - Public contact email
 * - Slug editor with validation
 * - Publish/Unpublish toggle
 *
 * Only available for Pro+ tier teachers
 */
export default function ProviderProfileEditor({ user, showNotification }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Profile data
  const [profileData, setProfileData] = useState({
    slug: '',
    provider_description: '',
    logo_url: '',
    cover_image_url: '',
    public_contact_email: '',
    profile_published_at: null,
    last_slug_change_at: null,
    package_tier: 'basic'
  });

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

  // Derived states
  const tier = profileData.package_tier;
  const isEligible = hasPublicProfile(tier);
  const canPublish = canPublishProfile(tier);
  const canChangeSlug = canEditSlug(tier);
  const showCoverImage = hasCoverImage(tier);
  const isPublished = !!profileData.profile_published_at;

  // Load profile data
  useEffect(() => {
    if (!user?.id) return;

    const loadProfile = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            slug,
            provider_description,
            logo_url,
            cover_image_url,
            public_contact_email,
            profile_published_at,
            last_slug_change_at,
            package_tier,
            full_name
          `)
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setProfileData({
          slug: data.slug || '',
          provider_description: data.provider_description || '',
          logo_url: data.logo_url || '',
          cover_image_url: data.cover_image_url || '',
          public_contact_email: data.public_contact_email || '',
          profile_published_at: data.profile_published_at,
          last_slug_change_at: data.last_slug_change_at,
          package_tier: data.package_tier || 'basic',
          full_name: data.full_name || ''
        });

        setNewSlug(data.slug || '');
      } catch (err) {
        console.error('Error loading profile:', err);
        showNotification?.('Fehler beim Laden des Profils', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id]);

  // Validate slug
  const validateSlug = async (slug) => {
    if (!slug) {
      setSlugValidation({ ...slugValidation, valid: false, error: 'Slug ist erforderlich' });
      return;
    }

    setSlugValidation({ ...slugValidation, checking: true });

    try {
      const response = await fetch('/api/provider/validate-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, providerId: user.id })
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

  // Generate slug from name
  const handleGenerateSlug = () => {
    if (!profileData.full_name) {
      showNotification?.('Bitte geben Sie zuerst einen Namen ein', 'error');
      return;
    }

    const generated = generateProviderSlug(profileData.full_name, []);
    setNewSlug(generated);
    validateSlug(generated);
  };

  // Save profile
  const handleSave = async () => {
    try {
      setSaving(true);

      const updateData = {
        provider_description: profileData.provider_description,
        logo_url: profileData.logo_url,
        public_contact_email: profileData.public_contact_email
      };

      // Include cover image only for Enterprise
      if (showCoverImage) {
        updateData.cover_image_url = profileData.cover_image_url;
      }

      // Update slug if changed and valid
      if (editingSlug && newSlug !== profileData.slug && slugValidation.valid && slugValidation.available && slugValidation.canChange) {
        updateData.slug = newSlug;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      if (updateData.slug) {
        setProfileData(prev => ({ ...prev, slug: updateData.slug }));
        setEditingSlug(false);
      }

      showNotification?.('Profil gespeichert', 'success');
    } catch (err) {
      console.error('Error saving profile:', err);
      showNotification?.('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Publish/Unpublish profile
  const togglePublish = async () => {
    if (!canPublish) return;

    // Check if slug exists before publishing
    if (!isPublished && !profileData.slug) {
      showNotification?.('Bitte setzen Sie zuerst eine Profil-URL', 'error');
      return;
    }

    try {
      setSaving(true);

      const updateData = {
        profile_published_at: isPublished ? null : new Date().toISOString()
      };

      // Auto-generate slug on first publish if not set
      if (!isPublished && !profileData.slug && profileData.full_name) {
        updateData.slug = generateProviderSlug(profileData.full_name, []);
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      setProfileData(prev => ({
        ...prev,
        profile_published_at: updateData.profile_published_at,
        slug: updateData.slug || prev.slug
      }));

      showNotification?.(
        isPublished ? 'Profil ist jetzt offline' : 'Profil wurde veröffentlicht!',
        'success'
      );
    } catch (err) {
      console.error('Error toggling publish:', err);
      showNotification?.('Fehler beim Aktualisieren', 'error');
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
      const fileName = `${user.id}/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('provider-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('provider-images')
        .getPublicUrl(fileName);

      const fieldName = type === 'logo' ? 'logo_url' : 'cover_image_url';
      setProfileData(prev => ({ ...prev, [fieldName]: urlData.publicUrl }));

      showNotification?.('Bild hochgeladen', 'success');
    } catch (err) {
      console.error('Error uploading image:', err);
      showNotification?.('Fehler beim Hochladen', 'error');
    } finally {
      setUploading(false);
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

  // Not eligible state
  if (!isEligible) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Info className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Öffentliches Profil
          </h2>
          <p className="text-gray-600 mb-6">
            Öffentliche Anbieterprofile sind ab dem <strong>Pro</strong> Paket verfügbar.
            Mit einem öffentlichen Profil erscheinen Sie im Anbieter-Verzeichnis und können
            Ihre Kurse besser präsentieren.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Ihr aktuelles Paket: <strong className="capitalize">{getTierLabel(tier)}</strong>
          </p>
          <button
            onClick={() => window.location.href = '/teacher-hub'}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            Pakete vergleichen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
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

      {/* Main Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Öffentliches Profil bearbeiten
        </h2>

        <div className="space-y-6">
          {/* Profile URL / Slug */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    onClick={() => {
                      setEditingSlug(false);
                      setNewSlug(profileData.slug);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Abbrechen
                  </button>
                </div>

                {/* Validation feedback */}
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
                <span className="text-gray-600 bg-gray-50 px-4 py-2.5 rounded-lg border border-gray-200 flex-1">
                  {profileData.slug ? (
                    <>{BASE_URL}/anbieter/{profileData.slug}</>
                  ) : (
                    <span className="text-gray-400">Noch keine URL gesetzt</span>
                  )}
                </span>
                {canChangeSlug && (
                  <button
                    onClick={() => setEditingSlug(true)}
                    className="px-4 py-2.5 text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {profileData.slug ? 'Ändern' : 'Setzen'}
                  </button>
                )}
                {!profileData.slug && (
                  <button
                    onClick={handleGenerateSlug}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Automatisch generieren
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Die URL kann maximal einmal pro Monat geändert werden.
            </p>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo
            </label>
            <div className="flex items-start gap-4">
              {profileData.logo_url ? (
                <img
                  src={profileData.logo_url}
                  alt="Logo"
                  className="w-20 h-20 rounded-xl object-cover border border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Image className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div>
                <label className="cursor-pointer">
                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-flex items-center">
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

          {/* Cover Image (Enterprise only) */}
          {showCoverImage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover-Bild
                <span className="ml-2 text-xs text-orange-500 font-normal">(Enterprise)</span>
              </label>
              <div className="space-y-3">
                {profileData.cover_image_url ? (
                  <img
                    src={profileData.cover_image_url}
                    alt="Cover"
                    className="w-full h-40 rounded-xl object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-full h-40 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Image className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <label className="cursor-pointer inline-block">
                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-flex items-center">
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beschreibung
            </label>
            <textarea
              value={profileData.provider_description}
              onChange={(e) => setProfileData(prev => ({ ...prev, provider_description: e.target.value }))}
              rows={5}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-orange-400 outline-none transition resize-none"
              placeholder="Beschreiben Sie Ihr Angebot, Ihre Qualifikationen und was Sie auszeichnet..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {profileData.provider_description.length}/1000 Zeichen
            </p>
          </div>

          {/* Public Contact Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Öffentliche Kontakt-E-Mail
              <span className="ml-2 text-xs text-gray-500 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={profileData.public_contact_email}
                onChange={(e) => setProfileData(prev => ({ ...prev, public_contact_email: e.target.value }))}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-orange-400 outline-none transition"
                placeholder="kontakt@meine-schule.ch"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Diese E-Mail wird öffentlich angezeigt. Lassen Sie das Feld leer, um nur das Kontaktformular anzubieten.
            </p>
          </div>

          {/* Website (readonly, from main profile) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website
            </label>
            <p className="text-sm text-gray-500">
              Die Website wird aus Ihren Profilangaben übernommen.
              Ändern Sie diese unter "Profil & Einstellungen".
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center"
          >
            {saving ? (
              <Loader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Änderungen speichern
          </button>
        </div>
      </div>
    </div>
  );
}
