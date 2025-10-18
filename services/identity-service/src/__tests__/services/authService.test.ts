import { AuthService } from '../../services/authService';
import { UserRepository } from '../../repositories/userRepository';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateTokens } from '../../utils/jwt';

// Mock dependencies
jest.mock('../../repositories/userRepository');
jest.mock('../../utils/password');
jest.mock('../../utils/jwt');
jest.mock('../../database/connection', () => ({
  getDatabase: jest.fn(() => ({
    query: jest.fn(),
  }))
}));

const mockUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;
const mockComparePassword = comparePassword as jest.MockedFunction<typeof comparePassword>;
const mockGenerateTokens = generateTokens as jest.MockedFunction<typeof generateTokens>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
    mockUserRepo = new mockUserRepository() as jest.Mocked<UserRepository>;
    (authService as any).userRepository = mockUserRepo;
  });

  describe('register', () => {
    const registerData = {
      email: 'test@example.com',
      password: 'password123',
      account_type: 'individual' as const,
      language: 'en' as const
    };

    it('should successfully register a new user', async () => {
      // Arrange
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('hashedPassword');
      
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashedPassword',
        account_type: 'individual' as const,
        status: 'active' as const,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      mockUserRepo.create.mockResolvedValue(mockUser);
      mockUserRepo.updateStatus.mockResolvedValue(undefined);
      
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      // Mock database query for storing refresh token
      const mockDB = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      (authService as any).db = mockDB;

      // Act
      const result = await authService.register(registerData);

      // Assert
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockHashPassword).toHaveBeenCalledWith('password123');
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        password_hash: 'hashedPassword',
        account_type: 'individual',
        language: 'en',
        phone: undefined
      });
      expect(result.access_token).toBe('access-token');
      expect(result.refresh_token).toBe('refresh-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      const existingUser = {
        id: 'existing-id',
        email: 'test@example.com',
        password_hash: 'hash',
        account_type: 'individual' as const,
        status: 'active' as const,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      mockUserRepo.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(authService.register(registerData)).rejects.toThrow();
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockHashPassword).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginData = {
      username: 'test@example.com',
      password: 'password123'
    };

    it('should successfully login with valid credentials', async () => {
      // Arrange
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashedPassword',
        account_type: 'individual' as const,
        status: 'active' as const,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      // Mock database query for storing refresh token
      const mockDB = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      (authService as any).db = mockDB;

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockComparePassword).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(result.access_token).toBe('access-token');
      expect(result.refresh_token).toBe('refresh-token');
    });

    it('should throw error with invalid credentials', async () => {
      // Arrange
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashedPassword',
        account_type: 'individual' as const,
        status: 'active' as const,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow();
      expect(mockComparePassword).toHaveBeenCalledWith('password123', 'hashedPassword');
    });

    it('should throw error if user not found', async () => {
      // Arrange
      mockUserRepo.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow();
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockComparePassword).not.toHaveBeenCalled();
    });
  });
});