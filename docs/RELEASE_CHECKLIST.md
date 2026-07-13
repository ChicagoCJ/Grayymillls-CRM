
### `RELEASE_CHECKLIST.md`

```markdown
# Graymills CRM Release Checklist

## Source and Build

- [ ] Working tree reviewed.
- [ ] No temporary inspection or patch files remain.
- [ ] `npm run build` passes.
- [ ] TypeScript passes.
- [ ] All intended routes appear in the build output.

## Database and Backup

- [ ] Current Supabase backup completed.
- [ ] Application backup export tested.
- [ ] Database migrations documented.
- [ ] Restore process reviewed.

## Permissions

- [ ] Every write-capable API route audited.
- [ ] Client write calls send permission headers.
- [ ] Admin role tested.
- [ ] Sales Manager role tested.
- [ ] Sales Rep role tested.
- [ ] Unauthorized operations return 403.

## Browser Testing

- [ ] Company editing tested.
- [ ] Contact editing tested.
- [ ] Activities tested.
- [ ] Opportunities tested.
- [ ] Tags tested.
- [ ] Imports tested.
- [ ] AI prospect analysis tested.
- [ ] Documents tested.

## Documentation

- [ ] `PROJECT_CONTEXT.md` updated.
- [ ] `CHANGELOG.md` updated.
- [ ] `FUTURE_REVISIONS.md` updated.
- [ ] `ARCHITECTURE.md` updated.
- [ ] `USER_GUIDE.md` updated.

## Production Release

- [ ] Version number updated.
- [ ] Revision note updated.
- [ ] Environment variables verified.
- [ ] Git commit completed.
- [ ] Git tag created if appropriate.
- [ ] Changes pushed.
- [ ] Vercel deployment passed.
- [ ] Production smoke test completed.