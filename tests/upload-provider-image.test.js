import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = { client: null };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockState.client),
}));

const { default: handler } = await import('../api/upload-provider-image.js');

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('upload-provider-image API', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');

    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/course-images/providers/user-1/logo_1.png' },
    });
    const profileUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const storageFrom = vi.fn(() => ({ upload, remove, getPublicUrl }));

    mockState.client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      storage: { from: storageFrom },
      from: vi.fn(() => ({ update: profileUpdate })),
    };
    mockState.upload = upload;
    mockState.profileUpdate = profileUpdate;
  });

  it('uploads for the authenticated user and updates the matching profile field', async () => {
    const response = makeResponse();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        imageBase64: Buffer.from('image-data').toString('base64'),
        fileName: 'logo.png',
        type: 'logo',
      },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.publicUrl).toContain('/providers/user-1/logo_1.png');
    expect(mockState.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^providers\/user-1\/logo_/),
      expect.any(Buffer),
      { upsert: false, contentType: 'image/png' },
    );
    expect(mockState.profileUpdate).toHaveBeenCalledWith({
      logo_url: expect.stringContaining('/providers/user-1/logo_1.png'),
    });
  });

  it('rejects requests without a bearer token', async () => {
    const response = makeResponse();
    await handler({ method: 'POST', headers: {}, body: {} }, response);

    expect(response.statusCode).toBe(401);
  });
});
