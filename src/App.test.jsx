import React from 'react';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn() }));
vi.mock('./supabase.js', () => ({ configured: false, supabase: { auth: mocks }, authRedirect: () => 'http://localhost/' }));
import App, { Auth, useResource } from './App.jsx';

beforeEach(() => vi.clearAllMocks());
describe('account screens', () => {
  it('explains setup when project settings are absent', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Ready for your Supabase project.' })).toBeInTheDocument();
    expect(screen.queryByText('Sign in →')).not.toBeInTheDocument();
  });
  it('signup uses a real email and profile metadata; confirmation does not open a dashboard', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Asha' } });
    fireEvent.change(screen.getByLabelText('Roll number'), { target: { value: 'dt01' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'asha@example.edu' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account →' }));
    expect(await screen.findByText(/Check your email to confirm/)).toBeInTheDocument();
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'asha@example.edu', options: expect.objectContaining({ data: { full_name: 'Asha', roll_number: 'DT01', year_of_study: '1st Year', locality: 'LB Nagar' } }) }));
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  });
  it('displays login errors and permits retry', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<Auth />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'asha@example.edu' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in →' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
    expect(screen.getByRole('button', { name: 'Sign in →' })).toBeEnabled();
  });
  it('sends recovery email and updates password through Supabase', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    const view = render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'asha@example.edu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send recovery link' }));
    expect(await screen.findByText(/If an account exists/)).toBeInTheDocument();
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('asha@example.edu', { redirectTo: 'http://localhost/?recovery=1' });
    mocks.updateUser.mockResolvedValue({ error: null });
    const done = vi.fn();
    view.rerender(<Auth recovery onRecovered={done} />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
  });
});
it('ignores stale resource responses after navigation or account unmount', async () => {
  let resolveFirst;
  const api = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValue({ data: ['new-route'] });
  const { result, rerender } = renderHook(({ path }) => useResource(api, path), { initialProps: { path: '/first' } });
  rerender({ path: '/second' });
  await waitFor(() => expect(result.current.data).toEqual(['new-route']));
  await act(async () => resolveFirst({ data: ['stale-private-data'] }));
  expect(result.current.data).toEqual(['new-route']);
});
