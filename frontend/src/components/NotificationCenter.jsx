import { useEffect, useState } from "react";

import socket, {
  connectSocket,
  disconnectSocket
} from "../services/socket";

import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from "../services/notificationService";

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      const data = await getNotifications();

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error(
        "Failed to load notifications:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleNotification = (data) => {
        console.log("REAL-TIME NOTIFICATION RECEIVED:", data);

        const newNotification = data.notification;

        if (!newNotification) {
        console.error("Notification payload is missing.");
        return;
        }

        setNotifications((current) => {
        const alreadyExists = current.some(
            (notification) =>
            notification._id === newNotification._id
        );

        if (alreadyExists) {
            return current;
        }

        return [newNotification, ...current];
        });

        setUnreadCount((current) => current + 1);
    };

    socket.on(
        "notification",
        handleNotification
    );

    connectSocket();

    return () => {
        socket.off(
        "notification",
        handleNotification
        );

        disconnectSocket();
    };
    }, []);

  const handleRead = async (notificationId) => {
    try {
      await markNotificationAsRead(
        notificationId
      );

      setNotifications((current) =>
        current.map((notification) =>
          notification._id === notificationId
            ? {
                ...notification,
                isRead: true
              }
            : notification
        )
      );

      setUnreadCount((current) =>
        Math.max(current - 1, 0)
      );
    } catch (error) {
      console.error(
        "Failed to mark notification as read:",
        error
      );
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsAsRead();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error(
        "Failed to mark notifications as read:",
        error
      );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Notifications
          </h2>

          <p className="text-slate-400 mt-1">
            Stay updated with your civic activity.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleReadAll}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-slate-400">
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-8 text-center">
          <p className="text-slate-400">
            No notifications yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification._id}
              className={`rounded-xl border p-4 transition ${
                notification.isRead
                  ? "bg-slate-900 border-slate-800"
                  : "bg-slate-800 border-slate-700"
              }`}
            >
              <div className="flex justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white">
                    {notification.title}
                  </h3>

                  <p className="text-slate-400 mt-1">
                    {notification.message}
                  </p>

                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(
                      notification.createdAt
                    ).toLocaleString()}
                  </p>
                </div>

                {!notification.isRead && (
                  <button
                    onClick={() =>
                      handleRead(
                        notification._id
                      )
                    }
                    className="text-sm text-blue-400 hover:text-blue-300 whitespace-nowrap"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;