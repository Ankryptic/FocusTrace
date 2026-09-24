using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace FocusTrace.Agent;

public static class CredentialStore
{
    private static readonly string DirectoryPath =
        Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder.LocalApplicationData
            ),
            "FocusTrace"
        );

    private static readonly string TokenPath =
        Path.Combine(DirectoryPath, "desktop.token");

    public static void SaveToken(string token)
    {
        Directory.CreateDirectory(DirectoryPath);

        var plaintext = Encoding.UTF8.GetBytes(token);

        var encrypted = ProtectedData.Protect(
            plaintext,
            null,
            DataProtectionScope.CurrentUser
        );

        File.WriteAllBytes(TokenPath, encrypted);
    }

    public static string? LoadToken()
    {
        if (!File.Exists(TokenPath))
            return null;

        try
        {
            var encrypted = File.ReadAllBytes(TokenPath);

            var plaintext = ProtectedData.Unprotect(
                encrypted,
                null,
                DataProtectionScope.CurrentUser
            );

            return Encoding.UTF8.GetString(plaintext);
        }
        catch
        {
            // If the credential cannot be decrypted,
            // treat it as unavailable.
            return null;
        }
    }

    public static void DeleteToken()
    {
        if (File.Exists(TokenPath))
        {
            File.Delete(TokenPath);
        }
    }
}