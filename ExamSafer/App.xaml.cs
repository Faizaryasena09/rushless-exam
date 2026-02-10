using System.Configuration;
using System.Data;
using System.Windows;

namespace ExamSafer;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        RegisterProtocol();

        string targetUrl = "about:blank"; // Default or Error Page

        if (e.Args.Length > 0)
        {
            string arg = e.Args[0];
            if (arg.StartsWith("rushlessexam:"))
            {
                // Format: rushlessexam:http://...
                // Depending on how browser passes it, it might be heavily encoded or just appended.
                // We strip the protocol prefix.
                targetUrl = arg.Substring("rushlessexam:".Length);
            }
            else
            {
               // Direct URL argument support for testing
               if (arg.StartsWith("http")) targetUrl = arg;
            }
        }

        MainWindow mainWindow = new MainWindow(targetUrl);
        mainWindow.Show();
    }

    private void RegisterProtocol()
    {
        try
        {
            // Simple registry check/add for HKEY_CURRENT_USER
            using (var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Classes\rushlessexam"))
            {
                string appPath = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName;
                if (appPath.EndsWith(".dll")) appPath = appPath.Replace(".dll", ".exe"); // Fix for .NET Core .dll path

                key.SetValue("", "URL:Rushless Exam Protocol");
                key.SetValue("URL Protocol", "");

                using (var defaultIcon = key.CreateSubKey("DefaultIcon"))
                {
                    defaultIcon.SetValue("", $"{appPath},1");
                }

                using (var commandKey = key.CreateSubKey(@"shell\open\command"))
                {
                    commandKey.SetValue("", $"\"{appPath}\" \"%1\"");
                }
            }
        }
        catch (Exception ex)
        {
            // Silently fail if not admin or registry access denied (though HKCU should be fine)
            System.Diagnostics.Debug.WriteLine("Failed to register protocol: " + ex.Message);
        }
    }
}

