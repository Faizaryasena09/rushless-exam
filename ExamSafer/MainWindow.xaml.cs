using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;

namespace ExamSafer;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window
{
    private string _targetUrl;

    public MainWindow(string url)
    {
        InitializeComponent();
        _targetUrl = url;
        InitializeAsync();
         
         // Kiosk Mode Enforcements
        this.PreviewKeyDown += MainWindow_PreviewKeyDown;
        this.Deactivated += MainWindow_Deactivated;
        this.Closing += MainWindow_Closing;
    }

    async void InitializeAsync()
    {
        await webView.EnsureCoreWebView2Async(null);
        
        // Allow JS to send messages to C#
        webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
        
        // Disable context menus and dev tools
        webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        webView.CoreWebView2.Settings.AreDevToolsEnabled = false;

        // Clear all browsing data to ensure a fresh session on start
        await ClearUserData();
        
        if (!string.IsNullOrEmpty(_targetUrl) && _targetUrl != "about:blank")
        {
             webView.Source = new Uri(_targetUrl);
        }
        else
        {
            MessageBox.Show("Invalid Exam URL. Closing.");
            Application.Current.Shutdown();
        }
    }

    private async Task ClearUserData()
    {
        if (webView != null && webView.CoreWebView2 != null)
        {
             await webView.CoreWebView2.Profile.ClearBrowsingDataAsync();
        }
    }

    private void MainWindow_Deactivated(object? sender, EventArgs e)
    {
        // Force focus back if deactivated (basic kiosk enforcement)
        this.Topmost = true;
        this.Activate();
        this.Focus();
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
         // Prevent closing? For now we allow standard closing methods that aren't blocked by Kiosk mode (like Alt+F4 if not handled)
         // But we should probably block everything except our explicit shutdown.
         // e.Cancel = true; // Use with caution, ensure Emergency Exit works!
    }

    private async void CoreWebView2_WebMessageReceived(object? sender, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs e)
    {
        string message = e.TryGetWebMessageAsString();
        if (message == "submit_success" || message == "force_close")
        {
            await ClearUserData();
            Application.Current.Shutdown();
        }
    }

    private async void MainWindow_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        // Emergency Exit: Ctrl + Shift + Alt + E
        if ((Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control &&
            (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift &&
            (Keyboard.Modifiers & ModifierKeys.Alt) == ModifierKeys.Alt &&
            e.Key == Key.E)
        {
            MessageBox.Show("Emergency Exit Triggered");
            await ClearUserData();
            Application.Current.Shutdown();
            return;
        }

        // Block Alt+F4
        if ((Keyboard.Modifiers & ModifierKeys.Alt) == ModifierKeys.Alt && e.SystemKey == Key.F4)
        {
            e.Handled = true;
        }
        
        // Block Refresh F5
        if (e.Key == Key.F5 || (e.Key == Key.R && (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control))
        {
             e.Handled = true;
        }
    }
}