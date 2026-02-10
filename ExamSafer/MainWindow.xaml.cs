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

using System.Diagnostics;
using System.Windows.Threading;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;

namespace ExamSafer;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window
{
    private string _targetUrl;
    private DispatcherTimer _timer;

    public MainWindow(string url)
    {
        InitializeComponent();
        _targetUrl = url;
        InitializeAsync();
         
         // Kiosk Mode Enforcements
        this.PreviewKeyDown += MainWindow_PreviewKeyDown;
        this.Deactivated += MainWindow_Deactivated;
        this.Closing += MainWindow_Closing;
        this.Loaded += MainWindow_Loaded;
        
        // Ensure Explorer comes back if app closes gracefully
        Application.Current.Exit += (s, e) => StartExplorer();
    }

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        StartKioskMode();
        SetupTimers();
    }

    private void StartKioskMode()
    {
        StopExplorer();
        Clipboard.Clear();
    }

    private void StopExplorer()
    {
        try
        {
            Process.Start(new ProcessStartInfo("taskkill", "/F /IM explorer.exe") { CreateNoWindow = true, UseShellExecute = false });
        }
        catch { /* Ignore if fails or already stopped */ }
    }

    private void StartExplorer()
    {
        try
        {
            // Check if explorer is already running
            if (Process.GetProcessesByName("explorer").Length == 0)
            {
                 Process.Start(new ProcessStartInfo("explorer.exe") { UseShellExecute = true });
            }
        }
        catch { /* Best effort */ }
    }

    private void SetupTimers()
    {
        _timer = new DispatcherTimer();
        _timer.Interval = TimeSpan.FromSeconds(1);
        _timer.Tick += UpdateStatus;
        _timer.Start();
        
        // Initial update
        UpdateStatus(null, null);
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS lpSystemPowerStatus);

    public struct SYSTEM_POWER_STATUS
    {
        public byte ACLineStatus;
        public byte BatteryFlag;
        public byte BatteryLifePercent;
        public byte SystemStatusFlag;
        public int BatteryLifeTime;
        public int BatteryFullLifeTime;
    }

    private void UpdateStatus(object? sender, EventArgs? e)
    {
        // 1. Clock
        ClockText.Text = DateTime.Now.ToString("HH:mm");

        // 2. Battery (Polling every 5s roughly)
        if (DateTime.Now.Second % 5 == 0 || sender == null)
        {
            if (GetSystemPowerStatus(out SYSTEM_POWER_STATUS status))
            {
                float percent = status.BatteryLifePercent;
                // 255 means untracked/unknown
                if (percent == 255)
                {
                     BatteryStatusText.Text = "AC";
                     BatteryStatusText.Foreground = Brushes.White;
                }
                else
                {
                    BatteryStatusText.Text = $"{percent}%";
                    
                    if (status.ACLineStatus == 1) // Online
                        BatteryStatusText.Foreground = Brushes.LightGreen;
                    else if (percent < 20)
                        BatteryStatusText.Foreground = Brushes.Red;
                    else
                        BatteryStatusText.Foreground = Brushes.White;
                }
            }
            else
            {
                BatteryStatusText.Text = "N/A";
            }

            // 3. Network
            bool isConnected = NetworkInterface.GetIsNetworkAvailable();
            NetworkStatusText.Text = isConnected ? "Connected" : "Offline";
            NetworkStatusText.Foreground = isConnected ? Brushes.LightGreen : Brushes.Red;
        }
    }

    private void BtnWifi_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            Process.Start(new ProcessStartInfo("ms-settings:network-wifi") { UseShellExecute = true });
        }
        catch
        {
            MessageBox.Show("Could not open Network Settings.");
        }
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
            Application.Current.Shutdown(); // This triggers Application.Exit -> StartExplorer
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