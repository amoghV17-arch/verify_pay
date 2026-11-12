import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowRight, User, Wallet, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { ApiError, apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

const AVATAR_SWATCHES = ['#337D70', '#202722', '#1F5E85', '#8E4A2E', '#5A4A78'];

export const OnboardingPage: React.FC = () => {
  const { user, refreshAuth } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const intentParam = params.get('intent') === 'freelancer' ? 'freelancer' : user?.lastWorkspace || 'client';
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || '');
  const [company, setCompany] = useState(user?.company || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#337D70');
  const [paypalEmail, setPaypalEmail] = useState(user?.payoutPaypalEmail || user?.email || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          company: company.trim() || undefined,
          avatarColor,
          lastWorkspace: intentParam,
        }),
      });
      await refreshAuth();
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : (err as Error)?.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!paypalEmail.trim()) {
      setStep(3);
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/me/payout', {
        method: 'PUT',
        body: JSON.stringify({ payoutPaypalEmail: paypalEmail.trim() }),
      });
      await refreshAuth();
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : (err as Error)?.message || 'Unable to save PayPal Sandbox email.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '1rem auto' }}>
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--teal-ink)' }}>
              Step {step} of 3
            </span>
            <h1 className="font-display" style={{ fontSize: '1.85rem', margin: '0.2rem 0 0 0' }}>
              Finish setting up your account
            </h1>
          </div>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => navigate(intentParam === 'freelancer' ? '/freelancer' : '/client')}
          >
            Skip for now
          </Button>
        </div>

        {/* Stepper Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {[
            { num: 1, label: 'Profile', icon: <User size={14} /> },
            { num: 2, label: 'Payout email', icon: <Wallet size={14} /> },
            { num: 3, label: 'First action', icon: <Sparkles size={14} /> },
          ].map((item) => {
            const active = step === item.num;
            const done = step > item.num;
            return (
              <div
                key={item.num}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${active ? 'var(--teal)' : 'var(--line)'}`,
                  backgroundColor: done ? 'var(--teal-soft)' : active ? 'var(--paper)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.82rem',
                  fontWeight: active || done ? 600 : 500,
                  color: 'var(--ink)',
                }}
              >
                {done ? <Check size={14} style={{ color: 'var(--teal)' }} /> : item.icon}
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="ms-alert ms-alert-danger" role="alert">
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ms-field">
              <label htmlFor="onb-name" className="ms-label">
                Display name
              </label>
              <input
                id="onb-name"
                type="text"
                required
                className="ms-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How collaborators see your name"
              />
            </div>

            <div className="ms-field">
              <label htmlFor="onb-company" className="ms-label">
                Company or studio <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="onb-company"
                type="text"
                className="ms-input"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Northwind Labs"
              />
            </div>

            <div className="ms-field">
              <span className="ms-label">Avatar color</span>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.2rem' }}>
                {AVATAR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Select color ${swatch}`}
                    aria-pressed={avatarColor === swatch}
                    onClick={() => setAvatarColor(swatch)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: swatch,
                      border: avatarColor === swatch ? '3px solid var(--ink)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="quiet" onClick={() => setStep(2)}>
                Skip step
              </Button>
              <Button type="submit" variant="primary" isLoading={saving} rightIcon={<ArrowRight size={15} />}>
                Save and continue
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSavePayout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
              Whenever you accept an invite as a freelancer, Milestone sends approved PayPal Sandbox payouts to your saved payout email.
            </p>
            <div className="ms-alert ms-alert-info">
              <span>PayPal Sandbox only — enter a PayPal Sandbox test buyer/personal email, never real banking info.</span>
            </div>
            <div className="ms-field">
              <label htmlFor="onb-paypal" className="ms-label">
                PayPal Sandbox payout email
              </label>
              <input
                id="onb-paypal"
                type="email"
                className="ms-input"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="sb-freelancer@personal.example.com"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="quiet" onClick={() => setStep(1)}>
                Back
              </Button>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <Button type="button" variant="quiet" onClick={() => setStep(3)}>
                  Skip for now
                </Button>
                <Button type="submit" variant="primary" isLoading={saving} rightIcon={<ArrowRight size={15} />}>
                  Save payout email
                </Button>
              </div>
            </div>
          </form>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
              Your account is ready. Choose what you would like to do first:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/client/new')}
                rightIcon={<ArrowRight size={16} />}
              >
                Create your first project
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/join')}
                rightIcon={<ArrowRight size={16} />}
              >
                Enter an invite code
              </Button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => navigate(intentParam === 'freelancer' ? '/freelancer' : '/client')}
              >
                Open workspace dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

