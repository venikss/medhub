from apps.administration.models import Department, Ward
from django.contrib.auth import get_user_model
User = get_user_model()

print('=== Departments ===')
for d in Department.objects.all():
    print(f'  [{d.id}] {d.name}')

print('\n=== Wards ===')
for w in Ward.objects.all():
    print(f'  [{w.id}] {w.name} | dept: {w.department}')

print('\n=== Doctors ===')
for u in User.objects.filter(role='doctor'):
    print(f'  [{u.id}] {u.get_full_name()} | {u.email}')
