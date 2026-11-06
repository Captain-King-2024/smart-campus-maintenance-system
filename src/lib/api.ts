import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { z } from 'zod';
import { AppError, check } from './errors';
import { requireUser, auth, login, logout } from './auth';
import { home, allow, workers } from './permissions';
import { serialize } from './mutation-lock';
import { complaints, assignments, inventory, feedback, technicians, admin } from '@/services';
import { repositories } from '@/repositories';
import { ReferenceService } from '@/services/ReferenceService';
import { adminSchemas } from './validation';
import type { AdminEntity } from '@/services/AdminService';
const references = new ReferenceService(repositories, complaints);
function ok(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status, headers: { 'Cache-Control': 'no-store' } });
}
async function body(req: Request) {
  check(req.headers.get('content-type')?.includes('application/json'), 'Use application/json', 415);
  check(Number(req.headers.get('content-length') ?? 0) < 65536, 'Request too large', 413);
  const text = await req.text();
  check(text.length < 65536, 'Request too large', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, 'Invalid JSON body');
  }
}
function positive(value: string) {
  const n = Number(value);
  check(Number.isSafeInteger(n) && n > 0, 'Invalid record ID');
  return n;
}
function method(req: Request, allowed: string[]) {
  if (!allowed.includes(req.method))
    throw new AppError(405, `Allowed methods: ${allowed.join(', ')}`);
}
async function dispatch(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname
    .replace(/^\/api\//, '')
    .split('/')
    .filter(Boolean);
  const [resource, rawId, child] = parts;
  const id = rawId ? positive(rawId) : undefined;
  if (resource === 'auth') {
    throw new AppError(404, 'Unknown route');
  }
  const user = await requireUser();
  if (resource === 'catalog') {
    method(req, ['GET']);
    return ok(await references.catalog(user));
  }
  if (resource === 'dashboard') {
    method(req, ['GET']);
    return ok(await references.dashboard(user));
  }
  if (resource === 'complaints') {
    if (id) {
      method(req, ['GET', 'PATCH']);
      return req.method === 'GET'
        ? ok(await complaints.detail(user, id))
        : ok(await complaints.patch(user, id, await body(req)));
    }
    method(req, ['GET', 'POST']);
    return req.method === 'GET'
      ? ok(await complaints.list(user, url.searchParams))
      : ok(await complaints.createComplaint(user, await body(req)), 201);
  }
  if (resource === 'assignments') {
    if (id) {
      method(req, ['GET', 'PATCH']);
      if (req.method === 'PATCH') return ok(await assignments.patch(user, id, await body(req)));
      const a = (await assignments.list(user)).find((a) => a.assignment_id === id);
      check(a, 'Assignment not found', 404);
      return ok({ assignment: a, ...(await complaints.detail(user, a.complaint_id)) });
    }
    method(req, ['GET', 'POST']);
    return req.method === 'GET'
      ? ok(await assignments.list(user))
      : ok(await assignments.assignTechnician(user, await body(req)), 201);
  }
  if (resource === 'work-logs') {
    method(req, ['GET', 'POST']);
    if (req.method === 'POST') return ok(await assignments.addWorkLog(user, await body(req)), 201);
    return ok(
      await references.workLogs(
        user,
        url.searchParams.get('assignment_id')
          ? positive(url.searchParams.get('assignment_id')!)
          : undefined,
      ),
    );
  }
  if (resource === 'inventory') {
    method(req, ['GET']);
    return ok(await inventory.list(user));
  }
  if (resource === 'materials' || resource === 'feedback') {
    method(req, ['GET', 'POST']);
    if (req.method === 'POST')
      return ok(
        resource === 'materials'
          ? await inventory.recordMaterialUsage(user, await body(req))
          : await feedback.submitFeedback(user, await body(req)),
        201,
      );
    return ok(
      await references.related(
        user,
        resource,
        url.searchParams.get('complaint_id')
          ? positive(url.searchParams.get('complaint_id')!)
          : undefined,
      ),
    );
  }
  if (resource === 'technicians') {
    method(req, ['GET']);
    return ok(await technicians.list(user));
  }
  if (resource === 'buildings' && id && child === 'rooms') {
    method(req, ['GET']);
    return ok(await references.buildingRooms(id));
  }
  if (resource in adminSchemas) {
    const key = resource as AdminEntity;
    if (req.method === 'GET' && !id) {
      if (['categories', 'buildings', 'rooms'].includes(key))
        return ok(await references.publicList(key as 'categories' | 'buildings' | 'rooms'));
      if (key === 'teams') {
        allow(user, workers);
        return ok(await references.teams(user));
      }
      return ok(await admin.list(user, key));
    }
    method(req, id ? ['PATCH', 'DELETE'] : ['POST']);
    if (req.method === 'DELETE') {
      await admin.remove(user, key, id!);
      return ok({ deleted: true });
    }
    return ok(await admin.save(user, key, await body(req), id), id ? 200 : 201);
  }
  throw new AppError(404, 'Unknown API route');
}
export async function handle(req: Request) {
  try {
    if (req.method !== 'GET') {
      const origin = req.headers.get('origin');
      check(
        !origin || origin === new URL(req.url).origin,
        'Cross-origin mutations are not permitted',
        403,
      );
    }
    // Authentication has its own resource names so IDs are never parsed as strings.
    const path = new URL(req.url).pathname;
    if (path === '/api/auth/session') {
      method(req, ['GET']);
      return ok(await auth.currentUser());
    }
    if (path === '/api/auth/login') {
      method(req, ['POST']);
      const data = z
        .object({ user_id: z.number().int().positive() })
        .strict()
        .parse(await body(req));
      const user = await login(data.user_id);
      return ok({ user, redirect: home(user.role) });
    }
    if (path === '/api/auth/logout') {
      method(req, ['POST']);
      await logout();
      return ok({ loggedOut: true });
    }
    return req.method === 'GET' ? await dispatch(req) : await serialize(() => dispatch(req));
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: 'Please correct the form fields',
          details: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            'Cache-Control': 'no-store',
            ...(error.status === 405
              ? { Allow: error.message.replace('Allowed methods: ', '') }
              : {}),
          },
        },
      );
    console.error(error);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
