export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 100;

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
export const PASSWORD_HAS_LETTER = /[a-zA-Z]/;
export const PASSWORD_HAS_NUMBER = /[0-9]/;
export const PASSWORD_HAS_UPPERCASE = /[A-Z]/;
export const PASSWORD_HAS_LOWERCASE = /[a-z]/;
export const PASSWORD_HAS_SPECIAL = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUsername(username: string): UsernameValidationResult {
  if (!username || typeof username !== 'string') {
    return {
      valid: false,
      error: 'Username is required and must be a string'
    };
  }

  const trimmed = username.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Username cannot be empty'
    };
  }

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`
    };
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Username must be at most ${USERNAME_MAX_LENGTH} characters`
    };
  }

  if (!USERNAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, and underscores'
    };
  }

  return {
    valid: true
  };
}

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      error: 'Password is required and must be a string'
    };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`
    };
  }

  if (!PASSWORD_HAS_LETTER.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one letter'
    };
  }

  if (!PASSWORD_HAS_NUMBER.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one number'
    };
  }

  return {
    valid: true
  };
}

export type PasswordStrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthScore {
  length: number;
  diversity: number;
  total: number;
}

export interface PasswordStrengthResult {
  level: PasswordStrengthLevel;
  score: PasswordStrengthScore;
  suggestions: string[];
  meetsRequirements: boolean;
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const suggestions: string[] = [];
  const meetsRequirements = validatePassword(password).valid;

  let lengthScore = 0;
  let diversityScore = 0;

  if (password.length >= PASSWORD_MIN_LENGTH) {
    if (password.length >= 8) {
      lengthScore += 1;
    }
    if (password.length >= 12) {
      lengthScore += 1;
    }
    if (password.length >= 16) {
      lengthScore += 1;
    }
  }

  const hasLowercase = PASSWORD_HAS_LOWERCASE.test(password);
  const hasUppercase = PASSWORD_HAS_UPPERCASE.test(password);
  const hasNumber = PASSWORD_HAS_NUMBER.test(password);
  const hasSpecial = PASSWORD_HAS_SPECIAL.test(password);

  if (hasLowercase) diversityScore += 1;
  if (hasUppercase) diversityScore += 1;
  if (hasNumber) diversityScore += 1;
  if (hasSpecial) diversityScore += 1;

  if (!hasLowercase && !hasUppercase) {
    suggestions.push('添加字母以增强密码强度');
  }
  if (!hasUppercase) {
    suggestions.push('添加大写字母以增强密码强度');
  }
  if (!hasSpecial) {
    suggestions.push('添加特殊字符（如 !@#$%^&*）以增强密码强度');
  }
  if (password.length < 8) {
    suggestions.push('使用至少8个字符的密码更安全');
  }
  if (password.length < 12 && meetsRequirements) {
    suggestions.push('使用12个或更多字符可获得更好的安全性');
  }

  const totalScore = lengthScore + diversityScore;

  let level: PasswordStrengthLevel = 'weak';
  if (totalScore >= 7) {
    level = 'strong';
  } else if (totalScore >= 5) {
    level = 'good';
  } else if (totalScore >= 3) {
    level = 'fair';
  }

  if (level === 'strong') {
    suggestions.length = 0;
    suggestions.push('密码强度很好！继续保持');
  } else if (level === 'good') {
    if (suggestions.length === 0) {
      suggestions.push('可以通过增加长度或添加特殊字符来进一步增强密码');
    }
  }

  return {
    level,
    score: {
      length: lengthScore,
      diversity: diversityScore,
      total: totalScore
    },
    suggestions,
    meetsRequirements
  };
}
