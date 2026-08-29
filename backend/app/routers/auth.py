from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import LoginIn, TokenOut
from ..security import verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    clean_username = payload.username.strip()
    user = db.query(User).filter(User.username == clean_username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_access_token(subject=user.username, role=user.role)
    return TokenOut(access_token=token, role=user.role.value if hasattr(user.role, "value") else str(user.role), username=user.username, full_name=user.full_name)
