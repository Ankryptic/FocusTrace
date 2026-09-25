using System.Windows;
using System.Windows.Media;

using WpfColor = System.Windows.Media.Color;

namespace FocusTrace.Agent;

public partial class MainWindow : Window
{
    private readonly Worker _worker;

    public MainWindow(Worker worker)
    {
        InitializeComponent();

        _worker = worker;

        _worker.StatusChanged += Worker_StatusChanged;

        UpdateUi(
            _worker.IsConnected,
            _worker.IsTrackingEnabled,
            _worker.ConnectionMessage
        );
    }

    private void Worker_StatusChanged(
    object? sender,
    Worker.AgentStatusChangedEventArgs e)
    {
        Dispatcher.Invoke(() =>
        {
            UpdateUi(
                e.IsConnected,
                e.IsTrackingEnabled,
                e.Message
            );
        });
    }

    private void UpdateUi(
        bool isConnected,
        bool isTrackingEnabled,
        string message)
    {
        if (!isConnected)
        {
            StatusIndicator.Fill =
                new SolidColorBrush(WpfColor.FromRgb(156, 163, 175));

            TrackingStatusText.Text = "Tracking DISABLED";
            TrackingStatusText.Foreground =
                new SolidColorBrush(WpfColor.FromRgb(55, 65, 81));

            ConnectButton.Content = "CONNECT";
            ConnectButton.IsEnabled = true;

            ConnectionStatusText.Text = message;

            return;
        }

        if (isTrackingEnabled)
        {
            StatusIndicator.Fill =
                new SolidColorBrush(WpfColor.FromRgb(34, 197, 94));

            TrackingStatusText.Text = "Tracking ENABLED";
            TrackingStatusText.Foreground =
                new SolidColorBrush(WpfColor.FromRgb(22, 101, 52));

            ConnectButton.Content = "DISCONNECT";
            ConnectButton.IsEnabled = true;

            ConnectionStatusText.Text = message;

            return;
        }

        // Connected but HR has disabled tracking.
        StatusIndicator.Fill =
            new SolidColorBrush(WpfColor.FromRgb(234, 179, 8));

        TrackingStatusText.Text = "Tracking DISABLED";
        TrackingStatusText.Foreground =
            new SolidColorBrush(WpfColor.FromRgb(133, 77, 14));

        ConnectButton.Content = "DISCONNECT";
        ConnectButton.IsEnabled = true;

        ConnectionStatusText.Text = "Connected — tracking disabled by HR";
    }

    private async void ConnectButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        ConnectButton.IsEnabled = false;

        try
        {
            if (_worker.IsConnected)
            {
                await _worker.DisconnectAsync();
            }
            else
            {
                await _worker.ConnectAsync();
            }
        }
        catch (Exception ex)
        {
            System.Windows.MessageBox.Show(
                ex.Message,
                "FocusTrace",
                MessageBoxButton.OK,
                MessageBoxImage.Error
            );
        }
        finally
        {
            ConnectButton.IsEnabled = true;
        }
    }

    protected override async void OnClosed(EventArgs e)
    {
        _worker.StatusChanged -= Worker_StatusChanged;

        await _worker.DisconnectAsync();

        base.OnClosed(e);
    }
}