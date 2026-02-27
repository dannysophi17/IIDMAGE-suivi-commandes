import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Extiende el tipo Request para incluir 'user'
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const app = express();
const prisma = new PrismaClient();

app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true
  })
);
app.use(express.json());

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));

const JWT_SECRET = process.env.JWT_SECRET || 'replace_me_with_a_secure_value';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@iidmage.local';

const FRONTEND_BASE_URL = (process.env.FRONTEND_URL || process.env.WEB_APP_URL || process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')[0]
  .trim()
  .replace(/\/+$/, '');

function commandeUrl(id: string) {
  return `${FRONTEND_BASE_URL}/commandes/${encodeURIComponent(id)}`;
}

const smtpUser = (process.env.SMTP_USER || ADMIN_EMAIL || '').trim();
const smtpPassword = ((process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '')
  .toString()
  .replace(/\s+/g, '')
  .trim());

const transporter = nodemailer.createTransport(
  process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_PORT) === '465',
        auth: {
          user: smtpUser,
          pass: smtpPassword
        }
      }
    : {
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPassword
        }
      }
);

function canSendMail() {
  return Boolean(smtpUser && smtpPassword && ADMIN_EMAIL);
}

function formatDateShort(value: Date | null | undefined) {
  if (!value) return '—';
  try {
    return value.toISOString().slice(0, 10);
  } catch {
    return '—';
  }
}

async function notifyAdminCommande(params: {
  kind: 'CREATED' | 'UPDATED';
  commandeId: string;
  clientName?: string | null;
  poseurName?: string | null;
  product?: string | null;
  etatBefore?: string | null;
  etatAfter?: string | null;
  datePoseBefore?: Date | null;
  datePoseAfter?: Date | null;
  actorEmail?: string | null;
}) {
  if (!canSendMail()) return;

  const subjectBase = params.kind === 'CREATED' ? 'Nouvelle commande' : 'Commande mise à jour';
  const client = params.clientName || '—';
  const product = params.product || '—';
  const poseur = params.poseurName || '—';

  const changes: Array<{ label: string; before: string; after: string }> = [];
  if (params.kind === 'UPDATED') {
    if ((params.etatBefore || null) !== (params.etatAfter || null)) {
      changes.push({ label: 'État', before: params.etatBefore || '—', after: params.etatAfter || '—' });
    }
    if (formatDateShort(params.datePoseBefore) !== formatDateShort(params.datePoseAfter)) {
      changes.push({
        label: 'Date de pose',
        before: formatDateShort(params.datePoseBefore),
        after: formatDateShort(params.datePoseAfter)
      });
    }
  }

  const subject = `${subjectBase} — ${client} (#${params.commandeId.slice(0, 8)})`;
  const link = commandeUrl(params.commandeId);

  const changesHtml =
    params.kind === 'UPDATED' && changes.length
      ? `<p><b>Changements</b></p>
         <ul>
           ${changes
             .map(
               c =>
                 `<li><b>${c.label}:</b> <span>${c.before}</span> → <span>${c.after}</span></li>`
             )
             .join('')}
         </ul>`
      : '';

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.4">
      <p><b>${subjectBase}</b></p>
      <p>
        <b>Client:</b> ${client}<br/>
        <b>Produit:</b> ${product}<br/>
        <b>Poseur:</b> ${poseur}<br/>
        <b>État:</b> ${params.etatAfter || params.etatBefore || '—'}<br/>
        <b>Date de pose:</b> ${formatDateShort(params.datePoseAfter || params.datePoseBefore)}
      </p>
      <p>
        <a href="${link}" target="_blank" rel="noreferrer" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #e5e7eb;background:#f9fafb;color:#111827;font-weight:600">
          Ouvrir la commande
        </a>
      </p>
      <p style="color:#666;font-size:12px">Lien direct: <a href="${link}" target="_blank" rel="noreferrer">${link}</a></p>
      ${changesHtml}
      ${params.actorEmail ? `<p style="color:#666;font-size:12px">Action par: ${params.actorEmail}</p>` : ''}
    </div>
  `;

  try {
    const to = [ADMIN_EMAIL, params.actorEmail || ''].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
    const uniqueTo = Array.from(new Set(to));
    await transporter.sendMail({
      from: smtpUser ? `IIDMAGE <${smtpUser}>` : 'IIDMAGE',
      to: uniqueTo,
      subject,
      text: `${subjectBase}\n\nClient: ${client}\nProduit: ${product}\nPoseur: ${poseur}\nÉtat: ${params.etatAfter || params.etatBefore || '—'}\nDate de pose: ${formatDateShort(
        params.datePoseAfter || params.datePoseBefore
      )}\nLien: ${link}`,
      html
    });
  } catch {
    // Best-effort email; never block the API.
  }
}

function dateOnly(value: Date) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return d;
  // Set to noon to avoid DST issues when adding/subtracting days.
  d.setHours(12, 0, 0, 0);
  return d;
}

function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isoYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function easterSunday(year: number) {
  // Meeus/Jones/Butcher algorithm (Gregorian calendar)
  const f = Math.floor;
  const a = year % 19;
  const b = f(year / 100);
  const c = year % 100;
  const d = f(b / 4);
  const e = b % 4;
  const g = f((8 * b + 13) / 25);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = f(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = f((a + 11 * h + 22 * l) / 451);
  const month = f((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

const frenchHolidayCache = new Map<number, Map<string, string>>();

function getFrenchHolidays(year: number) {
  const cached = frenchHolidayCache.get(year);
  if (cached) return cached;

  const map = new Map<string, string>();
  const fixed: Array<{ m: number; d: number; name: string }> = [
    { m: 0, d: 1, name: "Jour de l'an" },
    { m: 4, d: 1, name: 'Fête du Travail' },
    { m: 4, d: 8, name: 'Victoire 1945' },
    { m: 6, d: 14, name: 'Fête nationale' },
    { m: 7, d: 15, name: 'Assomption' },
    { m: 10, d: 1, name: 'Toussaint' },
    { m: 10, d: 11, name: 'Armistice 1918' },
    { m: 11, d: 25, name: 'Noël' }
  ];
  for (const h of fixed) {
    const dt = new Date(year, h.m, h.d, 12, 0, 0, 0);
    map.set(isoYmd(dt), h.name);
  }

  const easter = easterSunday(year);
  const add = (base: Date, days: number, name: string) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + days);
    dt.setHours(12, 0, 0, 0);
    map.set(isoYmd(dt), name);
  };
  add(easter, 1, 'Lundi de Pâques');
  add(easter, 39, 'Ascension');
  add(easter, 50, 'Lundi de Pentecôte');

  frenchHolidayCache.set(year, map);
  return map;
}

function holidayName(d: Date) {
  return getFrenchHolidays(d.getFullYear()).get(isoYmd(d)) || null;
}

function isNonWorkingDay(d: Date) {
  return isWeekend(d) || !!holidayName(d);
}

function subBusinessDays(from: Date, businessDays: number) {
  let d = dateOnly(from);
  let remaining = Math.max(0, Math.floor(businessDays || 0));
  while (remaining > 0) {
    d = new Date(d);
    d.setDate(d.getDate() - 1);
    if (isNonWorkingDay(d)) continue;
    remaining -= 1;
  }
  return dateOnly(d);
}

function addBusinessDays(from: Date, businessDays: number) {
  let d = dateOnly(from);
  let remaining = Math.max(0, Math.floor(businessDays || 0));
  while (remaining > 0) {
    d = new Date(d);
    d.setDate(d.getDate() + 1);
    if (isNonWorkingDay(d)) continue;
    remaining -= 1;
  }
  return dateOnly(d);
}

function toBusinessDayForward(from: Date) {
  let d = dateOnly(from);
  while (isNonWorkingDay(d)) {
    d = new Date(d);
    d.setDate(d.getDate() + 1);
    d = dateOnly(d);
  }
  return dateOnly(d);
}

function atHour(d: Date, hour: number) {
  const out = new Date(d);
  out.setHours(hour, 0, 0, 0);
  return out;
}

async function recreateMilestoneNotifications(params: {
  commandeId: string;
  dates: {
    date_production?: Date | null;
    date_expedition?: Date | null;
    date_livraison?: Date | null;
    date_pose?: Date | null;
  };
  actorEmail: string | null;
}) {
  const now = new Date();

  const milestones: Array<{ kind: 'PRODUCTION' | 'EXPEDITION' | 'LIVRAISON' | 'POSE'; date: Date | null }> = [
    { kind: 'PRODUCTION', date: params.dates.date_production ?? null },
    { kind: 'EXPEDITION', date: params.dates.date_expedition ?? null },
    { kind: 'LIVRAISON', date: params.dates.date_livraison ?? null },
    { kind: 'POSE', date: params.dates.date_pose ?? null }
  ];

  await (prisma as any).notification.deleteMany({
    where: {
      commandeId: params.commandeId,
      status: 'PENDING',
      channel: 'EMAIL',
      kind: { in: milestones.map(m => m.kind) }
    }
  });

  const createRows: any[] = [];
  for (const m of milestones) {
    if (!m.date) continue;
    const base = dateOnly(m.date);

    // Alerts: upcoming (2 business days before), due (same day), overdue (1 business day after).
    const upcoming = atHour(subBusinessDays(base, 2), 8);
    const due = atHour(base, 8);
    const overdue = atHour(addBusinessDays(base, 1), 8);

    for (const dueAt of [upcoming, due, overdue]) {
      if (dueAt.getTime() <= now.getTime()) continue;
      createRows.push({
        commandeId: params.commandeId,
        kind: m.kind,
        channel: 'EMAIL',
        dueAt,
        actorEmail: params.actorEmail
      });
    }
  }

  if (createRows.length) {
    await (prisma as any).notification.createMany({ data: createRows, skipDuplicates: true });
  }
}

function uniqStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(v => String(v || '').trim().toLowerCase()).filter(Boolean)));
}

function labelForKind(kind: string) {
  switch (kind) {
    case 'SURVEY':
      return 'Survey';
    case 'PRODUCTION':
      return 'Production';
    case 'EXPEDITION':
      return 'Expédition';
    case 'LIVRAISON':
      return 'Livraison';
    case 'POSE':
      return 'Pose';
    default:
      return kind;
  }
}

function milestoneDateForKind(commande: any, kind: string): Date | null {
  switch (kind) {
    case 'PRODUCTION':
      return (commande as any)?.date_production ?? null;
    case 'EXPEDITION':
      return (commande as any)?.date_expedition ?? null;
    case 'LIVRAISON':
      return (commande as any)?.date_livraison ?? null;
    case 'POSE':
      return (commande as any)?.date_pose ?? null;
    default:
      return null;
  }
}

function milestoneDoneAtForKind(commande: any, kind: string): Date | null {
  switch (kind) {
    case 'PRODUCTION':
      return (commande as any)?.done_production_at ?? null;
    case 'EXPEDITION':
      return (commande as any)?.done_expedition_at ?? null;
    case 'LIVRAISON':
      return (commande as any)?.done_livraison_at ?? null;
    case 'POSE':
      return (commande as any)?.done_pose_at ?? null;
    default:
      return null;
  }
}

async function sendNotificationEmail(params: {
  to: string[];
  kind: string;
  commande: any;
  dueAt: Date;
}) {
  if (!canSendMail()) throw new Error('SMTP not configured');
  const client = params.commande?.client?.name || '—';
  const product = params.commande?.product || '—';
  const poseur = params.commande?.poseur?.name || '—';
  const kindLabel = labelForKind(params.kind);
  const due = formatDateShort(params.dueAt);
  const link = commandeUrl(String(params.commande?.id || ''));

  const milestoneDate = milestoneDateForKind(params.commande, params.kind);
  let prefix = 'Rappel';
  if (milestoneDate) {
    const a = dateOnly(params.dueAt);
    const b = dateOnly(milestoneDate);
    if (a.getTime() < b.getTime()) prefix = 'Proche';
    else if (a.getTime() > b.getTime()) prefix = 'En retard';
    else prefix = 'Aujourd’hui';
  }

  const subject = `${prefix} ${kindLabel} — ${client} (#${String(params.commande?.id || '').slice(0, 8)})`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.4">
      <p><b>${prefix}: ${kindLabel}</b></p>
      <p><b>Date:</b> ${due}</p>
      <p>
        <b>Client:</b> ${client}<br/>
        <b>Produit:</b> ${product}<br/>
        <b>Poseur:</b> ${poseur}
      </p>
      <p>
        <a href="${link}" target="_blank" rel="noreferrer" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #e5e7eb;background:#f9fafb;color:#111827;font-weight:600">
          Ouvrir la commande
        </a>
      </p>
      <p style="color:#666;font-size:12px">Lien direct: <a href="${link}" target="_blank" rel="noreferrer">${link}</a></p>
    </div>
  `;

  await transporter.sendMail({
    from: smtpUser ? `IIDMAGE <${smtpUser}>` : 'IIDMAGE',
    to: params.to,
    subject,
    text: `Rappel: ${kindLabel}\nDate: ${due}\n\nClient: ${client}\nProduit: ${product}\nPoseur: ${poseur}\nLien: ${link}`,
    html
  });
}

function normalizeFullName(input: unknown) {
  if (typeof input !== 'string') return null;
  const value = input
    .trim()
    .replace(/\s+/g, ' ');
  if (value.length < 3) return null;
  // Require at least 2 parts (first + last name)
  if (!value.includes(' ')) return null;
  const [first, last] = value.split(' ');
  if (!first || !last) return null;
  return value;
}

function isImageMime(mime: string | undefined) {
  if (!mime) return false;
  return (
    mime === 'image/jpeg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    mime === 'image/gif' ||
    mime === 'image/heic' ||
    mime === 'image/heif'
  );
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req: Request, file: any, cb: (error: Error | null, destination: string) => void) =>
      cb(null, uploadsDir),
    filename: (req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
      const ext = path.extname(file.originalname || '').slice(0, 12);
      const safeExt = ext && ext.startsWith('.') ? ext : '';
      cb(null, `${crypto.randomUUID()}${safeExt}`);
    }
  }),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 12
  },
  fileFilter: (req: Request, file: any, cb: any) => {
    if (!isImageMime(file.mimetype)) return cb(new Error('only image files are allowed'));
    cb(null, true);
  }
});


app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/auth/forgot-password', async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'name and email required' });

  // Always respond OK to the client (avoid user enumeration / keep UX consistent).
  // If SMTP is configured, we notify the OWNER/ADMIN by email.
  if (!smtpUser || !smtpPassword) {
    return res.json({ ok: true, queued: false });
  }

  try {
    await transporter.sendMail({
      from: smtpUser ? `IIDMAGE <${smtpUser}>` : 'IIDMAGE',
      to: ADMIN_EMAIL,
      subject: 'Demande de réinitialisation de mot de passe (IIDMAGE)',
      text: `Demande de réinitialisation de mot de passe\n\nNom: ${name}\nEmail: ${email}`,
      html: `<p><b>Demande de réinitialisation de mot de passe</b></p><p>Nom: <b>${name}</b><br/>Email: <b>${email}</b></p>`
    });
    return res.json({ ok: true, queued: true });
  } catch {
    // Still return OK to avoid leaking server config errors.
    return res.json({ ok: true, queued: false });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, phone: (user as any).phone, role: user.role } });
});

function authMiddleware(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'missing token' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid auth header' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

app.post('/auth/register', authMiddleware, async (req, res) => {
  if (req.user.role !== 'OWNER') return res.status(403).json({ error: 'forbidden' });
  const { email, password, name, role, phone } = req.body;
  const fullName = normalizeFullName(name);
  if (!email || !password || !role) return res.status(400).json({ error: 'email/password/role required' });
  if (!fullName) return res.status(400).json({ error: 'name (first and last) required' });
  const hashed = await bcrypt.hash(password, 10);
  try {
    const created = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: fullName,
        role,
        ...(phone != null ? { phone: String(phone).trim() } : {})
      } as any
    });
    res.json({ id: created.id, email: created.email, name: created.name, phone: (created as any).phone, role: created.role });
  } catch (e) {
    res.status(400).json({ error: 'could not create user', detail: e instanceof Error ? e.message : String(e) });
  }
});

app.post('/auth/signup', async (req, res) => {
  // Public signup disabled (users are created by OWNER via /auth/register)
  res.status(404).json({ error: 'not found' });
});

app.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json({ id: user.id, email: user.email, name: user.name, phone: (user as any).phone, role: user.role });
});

app.patch('/me', authMiddleware, async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (name != null) {
    const fullName = normalizeFullName(name);
    if (!fullName) return res.status(400).json({ error: 'name (first and last) required' });
  }
  if (email != null && (typeof email !== 'string' || !email.includes('@'))) {
    return res.status(400).json({ error: 'invalid email' });
  }
  if (phone != null && typeof phone !== 'string' && typeof phone !== 'number') {
    return res.status(400).json({ error: 'invalid phone' });
  }
  if (password != null && (typeof password !== 'string' || password.trim().length < 6)) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  try {
    const hashed = password ? await bcrypt.hash(String(password).trim(), 10) : undefined;
    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(name != null ? { name: normalizeFullName(name) } : {}),
        ...(email != null ? { email: String(email).trim().toLowerCase() } : {}),
        ...(phone != null ? { phone: String(phone).trim() } : {}),
        ...(hashed ? { password: hashed } : {})
      } as any
    });
    res.json({ id: updated.id, email: updated.email, name: updated.name, phone: (updated as any).phone, role: updated.role });
  } catch (e) {
    res.status(400).json({ error: 'could not update profile', detail: e instanceof Error ? e.message : String(e) });
  }
});

app.get('/users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'OWNER') return res.status(403).json({ error: 'forbidden' });

  const pageRaw = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const page = Math.max(1, Number(pageRaw || 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(limitRaw || 8) || 8));
  const skip = (page - 1) * limit;

  const [total, items] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true } as any,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  res.json({ items, total, page, limit, totalPages });
});

app.patch('/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'OWNER') return res.status(403).json({ error: 'forbidden' });
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { role, name, password, email, phone } = req.body;
  if (name != null) {
    const fullName = normalizeFullName(name);
    if (!fullName) return res.status(400).json({ error: 'name (first and last) required' });
  }
  if (email != null && (typeof email !== 'string' || !email.includes('@'))) {
    return res.status(400).json({ error: 'invalid email' });
  }
  if (phone != null && typeof phone !== 'string' && typeof phone !== 'number') {
    return res.status(400).json({ error: 'invalid phone' });
  }
  if (password != null && (typeof password !== 'string' || password.trim().length < 6)) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  try {
    const hashed = password ? await bcrypt.hash(password, 10) : undefined;
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(role != null ? { role } : {}),
        ...(name != null ? { name: normalizeFullName(name) } : {}),
        ...(email != null ? { email: String(email).trim().toLowerCase() } : {}),
        ...(phone != null ? { phone: String(phone).trim() } : {}),
        ...(hashed ? { password: hashed } : {})
      } as any
    });

    // If OWNER changed password, notify the user by email (do NOT send plaintext password).
    if (password && smtpUser && smtpPassword) {
      transporter
        .sendMail({
          from: smtpUser ? `IIDMAGE <${smtpUser}>` : 'IIDMAGE',
          to: updated.email,
          subject: 'Votre mot de passe a été modifié (IIDMAGE)',
          text: `Bonjour,\n\nVotre mot de passe a été modifié par un administrateur.\nSi vous n’êtes pas à l’origine de cette demande, contactez votre administrateur immédiatement.\n\n— iiDmage`,
          html: `<p>Bonjour,</p><p>Votre mot de passe a été modifié par un administrateur.</p><p><b>Si vous n’êtes pas à l’origine de cette demande</b>, contactez votre administrateur immédiatement.</p><p>— iiDmage</p>`
        })
        .catch(() => undefined);
    }
    res.json({ id: updated.id, email: updated.email, name: updated.name, phone: (updated as any).phone, role: updated.role });
  } catch (e) {
    res.status(400).json({ error: 'could not update user', detail: e instanceof Error ? e.message : String(e) });
  }
});

app.delete('/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'OWNER') return res.status(403).json({ error: 'forbidden' });
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'could not delete user', detail: e instanceof Error ? e.message : String(e) });
  }
});


// List all clients
app.get('/clients', authMiddleware, async (req: Request, res: Response) => {
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, email: true, phone: true, address: true, notes: true, favorite: true } as any
  });
  res.json(clients);
});

// Get client detail
app.get('/clients/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, address: true, notes: true, favorite: true } as any
  });
  if (!client) return res.status(404).json({ error: 'not found' });
  res.json(client);
});
// Create client
app.post('/clients', authMiddleware, async (req: Request, res: Response) => {
  if (req.user.role === 'READONLY' || req.user.role === 'POSEUR') return res.status(403).json({ error: 'forbidden' });
  try {
    const { name, email, phone, address, notes } = (req.body || {}) as any;
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return res.status(400).json({ error: 'name is required' });

    const client = await prisma.client.create({
      data: {
        name: normalizedName,
        ...(email != null && String(email).trim() ? { email: String(email).trim().toLowerCase() } : {}),
        ...(phone != null && String(phone).trim() ? { phone: String(phone).trim() } : {}),
        ...(address != null && String(address).trim() ? { address: String(address).trim() } : {}),
        ...(notes != null && String(notes).trim() ? { notes: String(notes).trim() } : {})
      }
    });
    res.status(201).json(client);
  } catch (e) {
    res.status(400).json({ error: 'could not create client', detail: (e as Error).message });
  }
});

// Update client
app.patch('/clients/:id', authMiddleware, async (req: Request, res: Response) => {
  if (req.user.role === 'READONLY' || req.user.role === 'POSEUR') return res.status(403).json({ error: 'forbidden' });
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const { name, email, phone, address, notes, favorite } = (req.body || {}) as any;
    const data: any = {
      ...(name != null ? { name: String(name).trim() } : {}),
      ...(email != null ? { email: String(email).trim() ? String(email).trim().toLowerCase() : null } : {}),
      ...(phone != null ? { phone: String(phone).trim() ? String(phone).trim() : null } : {}),
      ...(address != null ? { address: String(address).trim() ? String(address).trim() : null } : {}),
      ...(notes != null ? { notes: String(notes).trim() ? String(notes).trim() : null } : {}),
      ...(favorite != null ? { favorite: Boolean(favorite) } : {})
    };
    if (data.name === '') return res.status(400).json({ error: 'name is required' });

    const updated = await prisma.client.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: 'could not update client', detail: e instanceof Error ? e.message : String(e) });
  }
});

// Delete client (only if no commandes)
app.delete('/clients/:id', authMiddleware, async (req: Request, res: Response) => {
  if (req.user.role !== 'OWNER' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'forbidden' });
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const count = await prisma.commande.count({ where: { clientId: id } });
    if (count > 0) {
      return res.status(400).json({
        error: 'client has commandes',
        message: 'Ce client est lié à des commandes. Suppression impossible.'
      });
    }
    await prisma.client.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'could not delete client', detail: e instanceof Error ? e.message : String(e) });
  }
});

// List all poseurs
app.get('/poseurs', authMiddleware, async (req: Request, res: Response) => {
  const poseurs = await prisma.poseur.findMany({
    select: { id: true, name: true, email: true, phone: true, zone: true, availability: true }
  });
  res.json(poseurs);
});

// Get poseur detail
app.get('/poseurs/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const poseur = await prisma.poseur.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, zone: true, availability: true }
  });
  if (!poseur) return res.status(404).json({ error: 'not found' });
  res.json(poseur);
});
// Create poseur
app.post('/poseurs', authMiddleware, async (req: Request, res: Response) => {
  if (req.user.role !== 'OWNER' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'forbidden' });
  try {
    const poseur = await prisma.poseur.create({
      data: {
        name: req.body.name,
        email: req.body.email || undefined,
        phone: req.body.phone || undefined,
        zone: req.body.zone || undefined,
        availability: typeof req.body.availability === 'boolean' ? req.body.availability : undefined
      }
    });
    res.status(201).json(poseur);
  } catch (e) {
    res.status(400).json({ error: 'could not create poseur', detail: (e as Error).message });
  }
});

// Update poseur
app.patch('/poseurs/:id', authMiddleware, async (req: Request, res: Response) => {
  if (req.user.role !== 'OWNER' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'forbidden' });
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const { name, email, phone, zone, availability } = (req.body || {}) as any;
    const data: any = {
      ...(name != null ? { name: String(name).trim() } : {}),
      ...(email != null ? { email: String(email).trim() ? String(email).trim().toLowerCase() : null } : {}),
      ...(phone != null ? { phone: String(phone).trim() ? String(phone).trim() : null } : {}),
      ...(zone != null ? { zone: String(zone).trim() ? String(zone).trim() : null } : {}),
      ...(availability != null ? { availability: Boolean(availability) } : {})
    };
    if (data.name === '') return res.status(400).json({ error: 'name is required' });

    const updated = await prisma.poseur.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: 'could not update poseur', detail: e instanceof Error ? e.message : String(e) });
  }
});

// Delete poseur (only if no commandes)
app.delete('/poseurs/:id', authMiddleware, async (req: Request, res: Response) => {
  if (req.user.role !== 'OWNER' && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'forbidden' });
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const count = await prisma.commande.count({ where: { poseurId: id } });
    if (count > 0) {
      return res.status(400).json({
        error: 'poseur has commandes',
        message: 'Ce poseur est lié à des commandes. Suppression impossible.'
      });
    }
    await prisma.poseur.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'could not delete poseur', detail: e instanceof Error ? e.message : String(e) });
  }
});

// List all commandes
app.get('/commandes', authMiddleware, async (req: Request, res: Response) => {
  const commandes = await prisma.commande.findMany({ include: { client: true, poseur: true } });
  res.json(commandes);
});

// Get commande detail (with attachments)
app.get('/commandes/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const commande = await prisma.commande.findUnique({
    where: { id },
    include: { client: true, poseur: true, attachments: true }
  });
  if (!commande) return res.status(404).json({ error: 'not found' });
  res.json(commande);
});

// Upload attachments (photos) for a commande
app.post(
  '/commandes/:id/attachments',
  authMiddleware,
  (req, res, next) => {
    if (req.user?.role === 'READONLY' || req.user?.role === 'POSEUR') {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  },
  upload.array('files', 12),
  async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const tagRaw = (req.body as any)?.tag ?? (req.body as any)?.type;
    const tag = typeof tagRaw === 'string' ? tagRaw.trim() : '';
    const normalizedTag = tag
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    if (!normalizedTag) {
      return res.status(400).json({ error: 'tag is required' });
    }

    const exists = await prisma.commande.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'not found' });

    const files = (((req as any).files || []) as any[]).filter(Boolean);
    if (!files.length) return res.status(400).json({ error: 'no files' });

    const created = await Promise.all(
      files.map(f =>
        prisma.attachment.create({
          data: {
            commandeId: id,
            type: normalizedTag,
            url: `/uploads/${f.filename}`,
            uploadedBy: req.user?.email || req.user?.userId || null
          } as any
        })
      )
    );

    res.status(201).json({ items: created });
  }
);

// Create a commande
app.post('/commandes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : '';
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const poseurIdRaw = req.body?.poseurId;
    const poseurId = typeof poseurIdRaw === 'string' ? (poseurIdRaw.trim() || undefined) : undefined;

    const commande = await prisma.commande.create({
      data: {
        clientId,
        poseurId,
        product: req.body.product,
        planningType: req.body.planningType === 'AUTO' ? 'AUTO' : 'CASUAL',
        date_commande: req.body.date_commande ? new Date(req.body.date_commande) : undefined,
        date_survey: req.body.date_survey ? new Date(req.body.date_survey) : undefined,
        date_production: req.body.date_production ? new Date(req.body.date_production) : undefined,
        date_expedition: req.body.date_expedition ? new Date(req.body.date_expedition) : undefined,
        date_livraison: req.body.date_livraison ? new Date(req.body.date_livraison) : undefined,
        date_pose: req.body.date_pose ? new Date(req.body.date_pose) : undefined,
        lieu_pose: req.body.lieu_pose,
        etat: typeof req.body.etat === 'string' && req.body.etat.trim() ? req.body.etat.trim() : 'A_PLANIFIER',
        priorite: req.body.priorite,
        commentaires: req.body.commentaires
      } as any
    });

    await recreateMilestoneNotifications({
      commandeId: commande.id,
      dates: {
        date_production: (commande as any).date_production ?? null,
        date_expedition: (commande as any).date_expedition ?? null,
        date_livraison: (commande as any).date_livraison ?? null,
        date_pose: (commande as any).date_pose ?? null
      },
      actorEmail: (req.user?.email || '').toString().trim() || null
    });

    // Fire-and-forget admin email (best-effort)
    void (async () => {
      try {
        const full = await prisma.commande.findUnique({
          where: { id: commande.id },
          include: { client: true, poseur: true }
        });
        await notifyAdminCommande({
          kind: 'CREATED',
          commandeId: commande.id,
          clientName: full?.client?.name,
          poseurName: full?.poseur?.name,
          product: full?.product,
          etatAfter: full?.etat,
          datePoseAfter: full?.date_pose,
          actorEmail: req.user?.email || null
        });
      } catch {
        // noop
      }
    })();

    res.status(201).json(commande);
  } catch (e) {
    res.status(400).json({ error: 'could not create commande', detail: (e as Error).message });
  }
});

// Update a commande
app.put('/commandes/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const before = await prisma.commande.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'not found' });

    const clientIdRaw = req.body?.clientId;
    if (typeof clientIdRaw === 'string' && clientIdRaw.trim() === '') {
      return res.status(400).json({ error: 'clientId is required' });
    }
    const poseurIdRaw = req.body?.poseurId;
    const poseurId = typeof poseurIdRaw === 'string' && poseurIdRaw.trim() === '' ? null : poseurIdRaw;

    const commande = await prisma.commande.update({
      where: { id },
      data: {
        clientId: clientIdRaw,
        poseurId,
        product: req.body.product,
        planningType: req.body.planningType === 'AUTO' ? 'AUTO' : 'CASUAL',
        date_commande: req.body.date_commande ? new Date(req.body.date_commande) : undefined,
        date_survey: req.body.date_survey ? new Date(req.body.date_survey) : undefined,
        date_production: req.body.date_production ? new Date(req.body.date_production) : undefined,
        date_expedition: req.body.date_expedition ? new Date(req.body.date_expedition) : undefined,
        date_livraison: req.body.date_livraison ? new Date(req.body.date_livraison) : undefined,
        date_pose: req.body.date_pose ? new Date(req.body.date_pose) : undefined,
        lieu_pose: req.body.lieu_pose,
        etat: req.body.etat,
        priorite: req.body.priorite,
        commentaires: req.body.commentaires
      } as any
    });

    await recreateMilestoneNotifications({
      commandeId: id,
      dates: {
        date_production: (commande as any).date_production ?? null,
        date_expedition: (commande as any).date_expedition ?? null,
        date_livraison: (commande as any).date_livraison ?? null,
        date_pose: (commande as any).date_pose ?? null
      },
      actorEmail: (req.user?.email || '').toString().trim() || null
    });

    void (async () => {
      try {
        const afterFull = await prisma.commande.findUnique({
          where: { id },
          include: { client: true, poseur: true }
        });

        const etatBefore = (before as any)?.etat ?? null;
        const etatAfter = (afterFull as any)?.etat ?? (commande as any)?.etat ?? null;
        const datePoseBefore = (before as any)?.date_pose ?? null;
        const datePoseAfter = (afterFull as any)?.date_pose ?? (commande as any)?.date_pose ?? null;

        // Only email if something meaningful changed.
        const changedEtat = (etatBefore || null) !== (etatAfter || null);
        const changedDatePose = formatDateShort(datePoseBefore) !== formatDateShort(datePoseAfter);
        if (!changedEtat && !changedDatePose) return;

        await notifyAdminCommande({
          kind: 'UPDATED',
          commandeId: id,
          clientName: afterFull?.client?.name,
          poseurName: afterFull?.poseur?.name,
          product: afterFull?.product,
          etatBefore,
          etatAfter,
          datePoseBefore,
          datePoseAfter,
          actorEmail: req.user?.email || null
        });
      } catch {
        // noop
      }
    })();

    res.json(commande);
  } catch (e) {
    res.status(400).json({ error: 'could not update commande', detail: (e as Error).message });
  }
});

// Generate retroplanning dates + schedule email notifications (business days, no weekends)
app.post(
  '/commandes/:id/retroplanning/generate',
  authMiddleware,
  (req, res, next) => {
    if (req.user?.role === 'READONLY' || req.user?.role === 'POSEUR') {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  },
  async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const overwrite = req.body?.overwrite === true;

    const commande = await prisma.commande.findUnique({
      where: { id },
      include: { client: true, poseur: true }
    });
    if (!commande) return res.status(404).json({ error: 'not found' });
    if (!commande.date_pose) return res.status(400).json({ error: 'date_pose is required for retroplanning' });

    const pose = dateOnly(commande.date_pose);

    // Retroplanning (jours ouvrés): keep expedition/livraison close to pose,
    // but if there is more lead time (commande far before pose), start production as early as possible.
    const commandeDate = commande.date_commande ? dateOnly(commande.date_commande) : subBusinessDays(pose, 15);
    const livraison = subBusinessDays(pose, 1);
    const expedition = subBusinessDays(pose, 2);
    const earliestProduction = toBusinessDayForward(addBusinessDays(commandeDate, 1));
    const production = earliestProduction;

    const computed: any = {
      planningType: 'AUTO',
      date_commande: commandeDate,
      date_production: production,
      date_expedition: expedition,
      date_livraison: livraison
    };

    const patch: any = { planningType: 'AUTO' };
    for (const key of ['date_commande', 'date_livraison', 'date_expedition', 'date_production'] as const) {
      if (overwrite || !(commande as any)[key]) {
        patch[key] = computed[key];
      }
    }

    const updated = await prisma.commande.update({ where: { id }, data: patch });

    await recreateMilestoneNotifications({
      commandeId: id,
      dates: {
        date_production: (updated as any).date_production ?? null,
        date_expedition: (updated as any).date_expedition ?? null,
        date_livraison: (updated as any).date_livraison ?? null,
        date_pose: (updated as any).date_pose ?? null
      },
      actorEmail: (req.user?.email || '').toString().trim() || null
    });

    res.json({ ok: true, commande: updated });
  }
);

// Mark/unmark milestones as done (used for calendar status + alert suppression)
app.patch(
  '/commandes/:id/milestones/:kind',
  authMiddleware,
  (req, res, next) => {
    if (req.user?.role === 'READONLY' || req.user?.role === 'POSEUR') {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  },
  async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const kindRaw = Array.isArray(req.params.kind) ? req.params.kind[0] : req.params.kind;
    const kind = String(kindRaw || '').trim().toUpperCase();
    const done = req.body?.done === true;

    const allowed = new Set(['PRODUCTION', 'EXPEDITION', 'LIVRAISON', 'POSE']);
    if (!allowed.has(kind)) return res.status(400).json({ error: 'invalid kind' });

    const fieldByKind: Record<string, string> = {
      PRODUCTION: 'done_production_at',
      EXPEDITION: 'done_expedition_at',
      LIVRAISON: 'done_livraison_at',
      POSE: 'done_pose_at'
    };

    const cascadeKindsByKind: Record<string, string[]> = {
      PRODUCTION: ['PRODUCTION'],
      EXPEDITION: ['PRODUCTION', 'EXPEDITION'],
      LIVRAISON: ['PRODUCTION', 'EXPEDITION', 'LIVRAISON'],
      POSE: ['PRODUCTION', 'EXPEDITION', 'LIVRAISON', 'POSE']
    };

    const field = fieldByKind[kind];

    const before = await prisma.commande.findUnique({
      where: { id },
      select: {
        etat: true,
        date_production: true,
        done_production_at: true,
        done_expedition_at: true,
        done_livraison_at: true,
        done_pose_at: true
      }
    });

    if (!before) return res.status(404).json({ error: 'not found' });

    if (!done) {
      const b: any = before || {};
      const laterDone = (() => {
        switch (kind) {
          case 'PRODUCTION':
            return !!(b.done_expedition_at || b.done_livraison_at || b.done_pose_at);
          case 'EXPEDITION':
            return !!(b.done_livraison_at || b.done_pose_at);
          case 'LIVRAISON':
            return !!b.done_pose_at;
          default:
            return false;
        }
      })();

      if (laterDone) {
        return res.status(409).json({
          error: "Impossible d'annuler: une étape suivante est déjà marquée comme faite. Annulez d'abord l'étape la plus avancée."
        });
      }
    }

    const etatRank: Record<string, number> = {
      A_PLANIFIER: 1,
      EN_PRODUCTION: 2,
      A_EXPEDIER: 3,
      LIVREE: 4,
      A_POSER: 5,
      POSEE: 6,
      FACTURE_A_ENVOYER: 7,
      FACTUREE: 8
    };

    const targetEtatByKind: Record<string, string> = {
      PRODUCTION: 'A_EXPEDIER',
      EXPEDITION: 'LIVREE',
      LIVRAISON: 'A_POSER',
      POSE: 'POSEE'
    };

    const currentEtat = (before as any)?.etat ? String((before as any).etat) : null;
    const targetEtat = targetEtatByKind[kind];
    const nextEtat = (() => {
      if (!done) return null;
      if (!targetEtat) return null;
      if (!currentEtat) return targetEtat;
      const curRank = etatRank[currentEtat] ?? 0;
      const targetRank = etatRank[targetEtat] ?? 0;
      // Never regress state; never override billing states with earlier ones.
      return targetRank > curRank ? targetEtat : null;
    })();

    const billingEtats = new Set(['FACTURE_A_ENVOYER', 'FACTUREE']);
    const shouldPreserveEtat = currentEtat != null && billingEtats.has(currentEtat);

    const derivedEtatAfterUnmark = (() => {
      if (done) return null;
      if (shouldPreserveEtat) return null;
      const b: any = before || {};
      const doneProduction = kind === 'PRODUCTION' ? null : (b.done_production_at ?? null);
      const doneExpedition = kind === 'EXPEDITION' ? null : (b.done_expedition_at ?? null);
      const doneLivraison = kind === 'LIVRAISON' ? null : (b.done_livraison_at ?? null);
      const donePose = kind === 'POSE' ? null : (b.done_pose_at ?? null);

      if (donePose) return 'POSEE';
      if (doneLivraison) return 'A_POSER';
      if (doneExpedition) return 'LIVREE';
      if (doneProduction) return 'A_EXPEDIER';
      if ((b as any).date_production) return 'EN_PRODUCTION';
      return 'A_PLANIFIER';
    })();

    const cascadeKinds = cascadeKindsByKind[kind] || [kind];
    const now = new Date();
    const doneFieldsPatch = (() => {
      if (!done) return { [field]: null } as any;
      const patch: any = {};
      for (const k of cascadeKinds) {
        const f = fieldByKind[k];
        if (!f) continue;
        const existing = (before as any)?.[f] ?? null;
        if (!existing) patch[f] = now;
      }
      // Ensure the requested milestone is marked done even if its field wasn't present in the select.
      if (field && !(before as any)?.[field]) patch[field] = now;
      return patch;
    })();

    const updated = await prisma.commande.update({
      where: { id },
      data: {
        ...doneFieldsPatch,
        ...(nextEtat ? { etat: nextEtat } : {}),
        ...(derivedEtatAfterUnmark ? { etat: derivedEtatAfterUnmark } : {})
      } as any
    });

    if (done) {
      await (prisma as any).notification.deleteMany({
        where: { commandeId: id, status: 'PENDING', channel: 'EMAIL', kind: { in: cascadeKinds } }
      });
    } else {
      await recreateMilestoneNotifications({
        commandeId: id,
        dates: {
          date_production: (updated as any).date_production ?? null,
          date_expedition: (updated as any).date_expedition ?? null,
          date_livraison: (updated as any).date_livraison ?? null,
          date_pose: (updated as any).date_pose ?? null
        },
        actorEmail: (req.user?.email || '').toString().trim() || null
      });
    }

    res.json({ ok: true, commande: updated });
  }
);

// Background loop: send due notifications (best-effort)
setInterval(() => {
  void (async () => {
    try {
      const due = await (prisma as any).notification.findMany({
        where: { status: 'PENDING', dueAt: { lte: new Date() }, channel: 'EMAIL' },
        orderBy: { dueAt: 'asc' },
        take: 25
      });
      if (!due.length) return;

      for (const n of due) {
        const commande = await prisma.commande.findUnique({
          where: { id: n.commandeId },
          include: { client: true, poseur: true }
        });
        if (!commande) {
          await (prisma as any).notification.update({
            where: { id: n.id },
            data: { status: 'FAILED', sentAt: new Date(), lastError: 'commande not found' }
          });
          continue;
        }

        const doneAt = milestoneDoneAtForKind(commande, String((n as any).kind));
        if (doneAt) {
          await (prisma as any).notification.update({
            where: { id: n.id },
            data: { status: 'SENT', sentAt: new Date(), lastError: 'skipped (already done)' }
          });
          continue;
        }

        const to = uniqStrings([ADMIN_EMAIL, (n as any).actorEmail || null]);
        try {
          await sendNotificationEmail({ to, kind: String(n.kind), commande, dueAt: n.dueAt });
          await (prisma as any).notification.update({
            where: { id: n.id },
            data: { status: 'SENT', sentAt: new Date(), lastError: null }
          });
        } catch (e: any) {
          await (prisma as any).notification.update({
            where: { id: n.id },
            data: {
              status: 'FAILED',
              sentAt: new Date(),
              lastError: e?.message ? String(e.message).slice(0, 500) : 'send failed'
            }
          });
        }
      }
    } catch {
      // never crash the server
    }
  })();
}, 60_000);

// Delete a commande
app.delete('/commandes/:id', authMiddleware, async (req: Request, res: Response) => {
  if (req.user?.role === 'READONLY' || req.user?.role === 'POSEUR') {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { commandeId: id } }),
      prisma.attachment.deleteMany({ where: { commandeId: id } }),
      prisma.commande.delete({ where: { id } })
    ]);
    res.json({ ok: true });
  } catch (e) {
    const msg = (e as any)?.message ? String((e as any).message) : String(e);
    const code = (e as any)?.code ? String((e as any).code) : '';
    if (code === 'P2025') {
      return res.status(404).json({ error: 'not found' });
    }
    res.status(400).json({ error: 'could not delete commande', detail: msg });
  }
});

// Upload middleware errors (multer / file type / size)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && typeof err.message === 'string' && (err.message.includes('only image files') || err.message.includes('File too large'))) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }
  if (err && err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many files' });
  }
  return next(err);
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Backend listening on ${port}`));
