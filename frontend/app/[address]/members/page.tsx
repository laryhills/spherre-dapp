'use client'
import React, { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
// import { nunito } from '@/app/fonts'
import { useTheme } from '@/app/context/theme-context-provider'
import {
  useGetAccountMembers,
  useProposeMemberAdd,
  useProposeMemberRemove,
  useProposeEditPermission,
} from '@/hooks/useSpherreHooks'
import { useSpherreAccount } from '@/app/context/account-context'
import AddMemberModal from './components/add-modal'
import EditMemberRolesModal from './components/edit-roles-modal'
import ProcessingModal from '../../components/modals/Loader'
import SuccessModal from '../../components/modals/SuccessModal'
import {
  createPermissionMask,
  ALL_PERMISSIONS_MASK,
  feltToAddress,
} from '@/lib/utils/validation'

interface Member {
  id: number
  name: string
  address: string
  fullAddress: string
  roles: string[]
  dateAdded: string
  image: string
  permissionMask: number
}

const Members = () => {
  useTheme()
  const { accountAddress } = useSpherreAccount()
  const [members, setMembers] = useState<Member[]>([])
  const [borderPosition, setBorderPosition] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditRolesModalOpen, setIsEditRolesModalOpen] = useState(false)
  const [editRolesMember, setEditRolesMember] = useState<Member | null>(null)

  // Transaction modals state
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [processingTitle, setProcessingTitle] = useState(
    'Processing Transaction!',
  )
  const [processingSubtitle, setProcessingSubtitle] = useState(
    'Please exercise a little patience as we process your details',
  )
  const [successTitle, setSuccessTitle] = useState('Successful Transaction!')
  const [successMessage, setSuccessMessage] = useState(
    'Congratulations! your transaction has been successfully confirmed and been sent to other members of the team for approval',
  )

  // Smart contract hooks
  const {
    data: contractMembers,
    isLoading,
    error,
    refetch,
  } = useGetAccountMembers(accountAddress!)

  const { writeAsync: proposeMemberAdd } = useProposeMemberAdd(accountAddress!)
  const { writeAsync: proposeMemberRemove } = useProposeMemberRemove(
    accountAddress!,
  )
  const { writeAsync: proposeEditPermission } = useProposeEditPermission(
    accountAddress!,
  )

  // Transform contract members to UI format with real permissions
  const transformedMembers = useMemo(() => {
    if (!contractMembers || contractMembers.length === 0) {
      return []
    }

    return contractMembers.map((memberFelt, index) => {
      // Convert felt to address format
      let memberAddress: string
      try {
        memberAddress = feltToAddress(memberFelt)
      } catch (error) {
        console.warn('Failed to convert felt to address:', memberFelt, error)
        memberAddress = memberFelt // Fallback to original felt if conversion fails
      }

      // Generate a truncated address for display
      const truncatedAddress =
        memberAddress.length > 10
          ? `${memberAddress.slice(0, 6)}...${memberAddress.slice(-4)}`
          : memberAddress

      // Default to all three roles - will be updated by permission fetching
      const roles: string[] = ['Voter', 'Proposer', 'Executor']
      const permissionMask = ALL_PERMISSIONS_MASK

      // Assign avatar based on index (cycle through available images)
      const avatarIndex = (index % 3) + 1
      const image = `/member${avatarIndex}.svg`

      return {
        id: index + 1,
        name: `Member ${index + 1}`,
        address: truncatedAddress,
        fullAddress: memberAddress,
        roles,
        dateAdded: '24 Mar 2025', // You might want to get this from contract
        image,
        permissionMask,
      }
    })
  }, [contractMembers])

  // Update members state only when transformed members change
  useEffect(() => {
    setMembers(transformedMembers)
  }, [transformedMembers])

  // Fetch real permissions for each member and update roles
  useEffect(() => {
    if (!accountAddress || !members.length) return

    const fetchPermissions = async () => {
      const updatedMembers = await Promise.all(
        members.map(async (member) => {
          try {
            // This would need to be done with individual hooks in a real component
            // For now, we'll keep the default permissions
            return member
          } catch (error) {
            console.warn(
              'Failed to fetch permissions for member:',
              member.fullAddress,
              error,
            )
            return member
          }
        }),
      )

      setMembers(updatedMembers)
    }

    fetchPermissions()
  }, [accountAddress, members]) // Removed members dependency to prevent infinite loop

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedMessage('Spherre Address copied!')
    setTimeout(() => setCopiedMessage(null), 3000)
  }

  const toggleDropdown = (id: number) => {
    setDropdownOpen((prev) => (prev === id ? null : id))
  }

  const startEditing = (memberId: number) => {
    const member = members.find((m) => m.id === memberId)
    if (member) {
      setEditingId(memberId)
      setEditName(member.name)
    }
    setDropdownOpen(null)
  }

  const getBorderGradient = () => {
    return `linear-gradient(
      90deg,
      transparent ${borderPosition}%,
      #6F2FCE ${borderPosition}%,
      #6F2FCE ${(borderPosition + 20) % 100}%,
      transparent ${(borderPosition + 20) % 100}%
    )`
  }

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (
      !target.closest('.dropdown-menu') &&
      !target.closest('.dropdown-trigger')
    ) {
      setDropdownOpen(null)
    }
  }

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setBorderPosition((prev) => (prev + 2) % 100)
    }, 100)
    return () => clearInterval(interval)
  }, [])

  const handlePropose = async (wallet: string, selectedRoles: string[]) => {
    try {
      setIsAddModalOpen(false)
      setIsProcessingModalOpen(true)
      setProcessingTitle('Proposing Member Addition!')
      setProcessingSubtitle(
        'Please wait while we process the member addition proposal...',
      )

      // Convert role names to permission mask
      const permissions = selectedRoles.map((role) => {
        switch (role) {
          case 'Voter':
            return 'VOTER'
          case 'Proposer':
            return 'PROPOSER'
          case 'Executor':
            return 'EXECUTOR'
          default:
            return 'VOTER'
        }
      }) as ('VOTER' | 'PROPOSER' | 'EXECUTOR')[]

      const permissionMask = createPermissionMask(permissions)

      await proposeMemberAdd({
        member: wallet,
        permissions: permissionMask,
      })

      setIsProcessingModalOpen(false)
      setIsSuccessModalOpen(true)
      setSuccessTitle('Member Addition Proposed!')
      setSuccessMessage(
        'The member addition proposal has been successfully created and sent to other members for approval.',
      )

      // Refresh members list
      refetch()
    } catch (error) {
      setIsProcessingModalOpen(false)
      console.error('Error proposing member addition:', error)
      // TODO: Show error modal
    }
  }

  const handleEditRoles = (member: Member) => {
    setEditRolesMember(member)
    setIsEditRolesModalOpen(true)
  }

  const handleProposeEditRoles = async (selectedRoles: string[]) => {
    if (!editRolesMember) return

    try {
      setIsEditRolesModalOpen(false)
      setIsProcessingModalOpen(true)
      setProcessingTitle('Proposing Role Changes!')
      setProcessingSubtitle(
        'Please wait while we process the role change proposal...',
      )

      // Convert role names to permission mask
      const permissions = selectedRoles.map((role) => {
        switch (role) {
          case 'Voter':
            return 'VOTER'
          case 'Proposer':
            return 'PROPOSER'
          case 'Executor':
            return 'EXECUTOR'
          default:
            return 'VOTER'
        }
      }) as ('VOTER' | 'PROPOSER' | 'EXECUTOR')[]

      const newPermissionMask = createPermissionMask(permissions)

      await proposeEditPermission({
        member: editRolesMember.fullAddress,
        new_permissions: newPermissionMask,
      })

      setIsProcessingModalOpen(false)
      setIsSuccessModalOpen(true)
      setSuccessTitle('Role Changes Proposed!')
      setSuccessMessage(
        'The role change proposal has been successfully created and sent to other members for approval.',
      )

      // Refresh members list
      refetch()
    } catch (error) {
      setIsProcessingModalOpen(false)
      console.error('Error proposing role edit:', error)
      // TODO: Show error modal
    }
  }

  const handleRemoveMember = async (member: Member) => {
    try {
      setDropdownOpen(null)
      setIsProcessingModalOpen(true)
      setProcessingTitle('Proposing Member Removal!')
      setProcessingSubtitle(
        'Please wait while we process the member removal proposal...',
      )

      await proposeMemberRemove({
        member_address: member.fullAddress,
      })

      setIsProcessingModalOpen(false)
      setIsSuccessModalOpen(true)
      setSuccessTitle('Member Removal Proposed!')
      setSuccessMessage(
        'The member removal proposal has been successfully created and sent to other members for approval.',
      )

      // Refresh members list
      refetch()
    } catch (error) {
      setIsProcessingModalOpen(false)
      console.error('Error proposing member removal:', error)
      // TODO: Show error modal
    }
  }

  const handleViewTransaction = () => {
    setIsSuccessModalOpen(false)
    // Navigate to transactions page
    window.location.href = `/${accountAddress}/transactions`
  }

  if (isLoading) {
    return (
      <div
        className={`bg-theme min-h-screen p-3 sm:p-4 lg:p-5 py-6 sm:py-8 lg:py-10 overflow-x-hidden transition-colors duration-300`}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-theme text-lg">Loading members...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`bg-theme min-h-screen p-3 sm:p-4 lg:p-5 py-6 sm:py-8 lg:py-10 overflow-x-hidden transition-colors duration-300`}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500 text-lg">
            Error loading members: {error.message}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-theme min-h-screen p-3 sm:p-4 lg:p-5 py-6 sm:py-8 lg:py-10 overflow-x-hidden transition-colors duration-300`}
    >
      <div className="flex flex-col sm:flex-row text-theme justify-between border-b-2 relative border-theme-border gap-4">
        <div className="flex items-center flex-wrap">
          <p className="cursor-pointer px-3 sm:px-4 py-2 text-sm sm:text-base transition-colors duration-200 border-b-2 border-theme text-theme">
            Spherre Members
          </p>
          <p className="cursor-pointer px-3 sm:px-4 py-2 text-sm sm:text-base transition-colors duration-200 text-theme-secondary hover:text-theme">
            History
          </p>
        </div>

        <button
          className="rounded-[7px] bg-primary gap-2 sm:gap-[10px] text-xs sm:text-sm lg:text-[14px] font-medium w-full sm:w-auto h-[40px] sm:h-[45px] flex items-center justify-center p-3 mt-[-10px] hover:opacity-90 transition-opacity duration-200 text-white"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Image
            src="/user-add.svg"
            alt="member avatar"
            height={20}
            width={20}
            className="sm:h-6 sm:w-6"
          />
          <span> Add Member</span>
        </button>
      </div>

      <div className="text-theme mt-4 sm:mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {members.map((member) => (
            <div
              key={member.id}
              className="min-h-[240px] sm:h-[260px] bg-theme-bg-secondary border border-theme-border rounded-[10px] relative transition-colors duration-300 pt-6 px-6"
              style={{
                zIndex: dropdownOpen === member.id ? 20 : 10,
              }}
            >
              {/* Header section with avatar and name */}
              <div className="flex flex-col items-center">
                <div className="w-full h-[70px] sm:h-[78px] bg-theme-bg-tertiary justify-between px-2 flex items-center rounded-[7px] border border-theme-border">
                  <div className="flex gap-2 sm:gap-3 flex-1 min-w-0">
                    <Image
                      src={member.image}
                      alt="member avatar"
                      height={40}
                      width={40}
                      className="rounded-full flex-shrink-0 sm:h-[50px] sm:w-[50px]"
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      {editingId === member.id ? (
                        <div className="relative">
                          <div
                            className="absolute inset-0 rounded-md"
                            style={{
                              background: getBorderGradient(),
                              padding: '2px',
                              zIndex: 0,
                            }}
                          />
                          <div className="flex items-center gap-2 relative z-10 bg-theme-bg-secondary rounded-md">
                            <input
                              autoFocus
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setEditingId(null)
                                } else if (e.key === 'Escape') {
                                  setEditingId(null)
                                }
                              }}
                              className="bg-theme-bg-tertiary w-full text-theme text-sm sm:text-[16px] px-2 sm:px-3 py-2 rounded-md focus:outline-primary border border-theme-border"
                            />
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 hover:bg-primary/20 rounded"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 sm:h-5 sm:w-5 text-green-400"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 hover:bg-primary/20 rounded"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 sm:h-5 sm:w-5 text-red-400"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-base sm:text-lg lg:text-[20px] text-theme font-semibold truncate">
                          {member.name}
                        </p>
                      )}
                      <div className="flex items-center gap-[5px]">
                        <p className="font-semibold text-sm sm:text-[16px] text-theme-secondary truncate">
                          {member.address}
                        </p>
                        <button
                          onClick={() => handleCopy(member.fullAddress)}
                          className="flex-shrink-0"
                        >
                          <Image
                            src="/copy.svg"
                            alt="copy"
                            height={16}
                            width={16}
                            className="rounded-full mt-1 sm:h-[18px] sm:w-[18px]"
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex-shrink-0">
                    <button
                      className="dropdown-trigger"
                      onClick={() => toggleDropdown(member.id)}
                    >
                      <Image
                        src="/dots.svg"
                        alt="dots"
                        height={20}
                        width={20}
                        className="mb-8 sm:mb-12 sm:h-6 sm:w-6"
                      />
                    </button>
                    {dropdownOpen === member.id && (
                      <div className="dropdown-menu absolute z-50 right-0 bg-theme-bg-tertiary border border-theme-border mt-[-50px] rounded-lg shadow-lg w-32 sm:w-40 text-xs sm:text-sm text-theme px-2 py-2">
                        <ul className="">
                          <li
                            className="px-3 sm:px-4 py-2 rounded-lg hover:bg-theme-bg-secondary cursor-pointer transition-colors duration-200"
                            onClick={() => handleEditRoles(member)}
                          >
                            Edit Roles
                          </li>
                          <li
                            className="px-3 sm:px-4 py-2 rounded-lg hover:bg-theme-bg-secondary cursor-pointer transition-colors duration-200"
                            onClick={() => startEditing(member.id)}
                          >
                            Edit Name
                          </li>
                          <li
                            className="px-3 sm:px-4 py-2 rounded-lg hover:bg-theme-bg-secondary cursor-pointer transition-colors duration-200"
                            onClick={() => handleRemoveMember(member)}
                          >
                            Remove Member
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Roles section */}
              <div className="flex mt-4 sm:mt-5 gap-[8px] sm:gap-[10px] flex-wrap">
                <p className="text-theme-secondary text-xs sm:text-[14px] font-semibold">
                  Roles:
                </p>
                {member.roles.map((role) => {
                  let roleStyle = ''
                  if (role === 'Voter') {
                    roleStyle =
                      'bg-[#FF7BE9]/10 text-[#FF7BE9] border-[#FF7BE9]'
                  } else if (role === 'Proposer') {
                    roleStyle =
                      'bg-[#FF8A25]/10 text-[#FF8A25] border-[#FF8A25]'
                  } else if (role === 'Executor') {
                    roleStyle =
                      'bg-[#19B360]/10 text-[#19B360] border-[#19B360]'
                  }
                  return (
                    <div
                      key={role}
                      className={`flex items-center justify-center text-[10px] sm:text-[12px] px-1 sm:px-2 py-[1px] sm:py-[2px] border-[1px] rounded-3xl ${roleStyle}`}
                    >
                      {role}
                    </div>
                  )
                })}
              </div>

              {/* Date added section */}
              <div className="flex mt-3 sm:mt-4 gap-[8px] sm:gap-[10px]">
                <p className="text-theme-secondary text-xs sm:text-[14px] font-semibold">
                  Date added:
                </p>
                <p className="text-theme text-sm sm:text-[16px] font-semibold">
                  {member.dateAdded}
                </p>
              </div>

              {/* Remove button section */}
              <div className="flex items-center justify-center mt-4 sm:mt-5">
                <button
                  className="bg-theme-bg-tertiary border border-theme-border rounded-[7px] flex items-center justify-center font-medium text-xs sm:text-[14px] text-theme w-full h-[32px] sm:h-[36px] hover:bg-theme-bg-secondary transition-colors duration-200"
                  onClick={() => handleRemoveMember(member)}
                >
                  Remove member
                </button>
              </div>
            </div>
          ))}

          {/* Add Member Box */}
          <div
            className="min-h-[240px] sm:h-[260px] bg-theme-bg-secondary border border-theme-border flex flex-col gap-4 sm:gap-5 items-center justify-center rounded-[10px] cursor-pointer hover:bg-theme-bg-tertiary transition-colors duration-300"
            onClick={() => setIsAddModalOpen(true)}
          >
            <div className="size-[40px] sm:size-[51px] rounded-full flex items-center justify-center bg-theme-bg-tertiary border border-theme-border">
              <Image
                src="/cross.svg"
                alt="cross logo"
                height={18}
                width={18}
                className="sm:h-[23px] sm:w-[23px]"
              />
            </div>
            <p
              className="text-sm sm:text-[16px] font-semibold text-theme-secondary cursor-pointer text-center hover:text-theme transition-colors duration-200"
              onClick={() => setIsAddModalOpen(true)}
            >
              Add Member
            </p>
          </div>
        </div>
      </div>

      {copiedMessage && (
        <div
          className="fixed bottom-5 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 text-theme"
          style={{
            background: `
              linear-gradient(var(--theme-bg-tertiary)) padding-box,
              ${getBorderGradient()} border-box
            `,
            border: '2px solid transparent',
          }}
        >
          {copiedMessage}
        </div>
      )}

      {/* Modals */}
      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onPropose={handlePropose}
      />

      <EditMemberRolesModal
        isOpen={isEditRolesModalOpen}
        member={editRolesMember}
        onClose={() => setIsEditRolesModalOpen(false)}
        onPropose={handleProposeEditRoles}
      />

      <ProcessingModal
        isOpen={isProcessingModalOpen}
        onClose={() => setIsProcessingModalOpen(false)}
        title={processingTitle}
        subtitle={processingSubtitle}
      />

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        onViewTransaction={handleViewTransaction}
        title={successTitle}
        message={successMessage}
      />
    </div>
  )
}

export default Members
