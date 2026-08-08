/// Mirrors API `USERNAME_CHANGE_COOLDOWN_DAYS`.
const usernameChangeCooldownDays = 14;

/// When the handle can be changed again, or null if rename is allowed now.
DateTime? usernameRenameUnlockAt(String? usernameChangedAt, {DateTime? now}) {
  if (usernameChangedAt == null || usernameChangedAt.isEmpty) return null;
  final changed = DateTime.tryParse(usernameChangedAt);
  if (changed == null) return null;
  final unlockExact = changed.toUtc().add(const Duration(days: usernameChangeCooldownDays));
  final clock = (now ?? DateTime.now()).toUtc();
  if (!unlockExact.isAfter(clock)) return null;
  return unlockExact;
}

bool isUsernameRenameLocked(String? usernameChangedAt, {DateTime? now}) {
  return usernameRenameUnlockAt(usernameChangedAt, now: now) != null;
}

String formatUsernameUnlockDate(DateTime unlock) {
  final u = unlock.toUtc();
  final y = u.year.toString().padLeft(4, '0');
  final m = u.month.toString().padLeft(2, '0');
  final d = u.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}
