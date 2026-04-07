from app.services.delivery import DeliveryService
from app.services.message_ingest import MessageIngestService
from app.services.message_store import InMemoryMessageStore
from app.services.presence import PresenceService
from app.services.unread_counter import UnreadCounterService

presence_service = PresenceService()
delivery_service = DeliveryService()
message_ingest_service = MessageIngestService()
message_store_service = InMemoryMessageStore()
unread_counter_service = UnreadCounterService()
