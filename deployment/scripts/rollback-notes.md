# Rollback Procedures for ALEX

## Quick Rollback Commands

### Firebase Hosting Rollback
```bash
# List deployed versions
firebase hosting:channel:list

# Rollback to previous version
firebase hosting:clone <SOURCE_SITE>:<SOURCE_CHANNEL> <TARGET_SITE>:live
```

### Firebase Functions Rollback
```bash
# List deployed functions
firebase functions:list

# Rollback specific function
firebase functions:delete <function-name> --force
# Then redeploy previous version
firebase deploy --only functions:<function-name>
```

### Firestore Rules Rollback
```bash
# Deploy previous rules version
firebase deploy --only firestore:rules
```

## Manual Rollback Steps

1. **Identify the issue**: Check Firebase Console > Functions > Logs or Hosting > History
2. **Determine rollback target**: Identify the last known good deployment
3. **Execute rollback**: Use commands above based on affected service
4. **Verify**: Test critical user flows after rollback
5. **Document**: Record incident and rollback in deployment log

## Emergency Contacts

- Firebase Support: https://firebase.google.com/support
- On-call engineer: [Add contact info]

## Post-Rollback Checklist

- [ ] Verify core functionality works
- [ ] Check error rates in monitoring
- [ ] Notify team of rollback
- [ ] Create incident report
- [ ] Plan fix for next deployment